import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";
import ptBr from "@fullcalendar/core/locales/pt-br";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  CALENDAR_TYPES,
  CALENDAR_TYPE_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  calendarWriteSchema,
  expandRoutine,
  routineWriteSchema,
} from "rotina-bonette-shared";
import type { Priority } from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Dialog, Field, controlClass } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { cx } from "../../lib/format";
import { days } from "../routines/RoutinesPage";
import type { CalendarBlock, Project, Routine, Settings, Task } from "../../types";

// Abaixo de 768px (breakpoint md) a semana não cabe: usa a visão de dia.
const isMobile = () => window.matchMedia("(max-width: 767px)").matches;

type FormValues = z.infer<typeof calendarWriteSchema>;
type RoutineValues = z.infer<typeof routineWriteSchema>;
// Um editor serve para bloco avulso (uma data) e rotina fixa (toda semana).
type Editor = {
  kind: "block" | "routine";
  block: CalendarBlock | null;
  routine: Routine | null;
  start: string;
  end: string;
  title?: string;
  occurrence?: Occurrence;
};

// Ocorrência de uma rotina clicada no calendário.
type Occurrence = { routine: Routine; date: string };

const priorityDot: Record<Priority, string> = {
  P1: "bg-hot",
  P2: "bg-strategy",
  P3: "bg-warn",
  P4: "bg-muted",
};

function pad(part: number) {
  return String(part).padStart(2, "0");
}

function PriorityPicker({ value, onChange }: { value: Priority; onChange: (value: Priority) => void }) {
  return (
    <div role="radiogroup" aria-label="Prioridade" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {PRIORITIES.map((item) => (
        <button
          key={item}
          type="button"
          role="radio"
          aria-checked={value === item}
          onClick={() => onChange(item)}
          className={cx(
            "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-2.5 text-left text-xs font-semibold transition-colors duration-150",
            value === item ? "border-focus bg-focus/10 text-ink" : "border-line bg-panel-2/60 text-muted hover:text-ink",
          )}
        >
          <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", priorityDot[item])} />
          {PRIORITY_LABEL[item]}
        </button>
      ))}
    </div>
  );
}

const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const addDays = (date: string, amount: number) => {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return localDate(next);
};
const slotOf = (
  day: number,
  values: { startTime?: string | null; durationMinutes: number; dayTimes?: RoutineValues["dayTimes"] },
) => values.dayTimes?.[String(day)] ?? { startTime: values.startTime ?? "09:00", durationMinutes: values.durationMinutes };
const shortDate = (date: string) => date.split("-").reverse().slice(0, 2).join("/");
const INTERVAL_LABEL: Record<number, string> = { 1: "Toda semana", 2: "A cada 2 semanas (quinzenal)", 3: "A cada 3 semanas", 4: "A cada 4 semanas" };

function toLocalInput(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function nextHourRange() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function CalendarPage() {
  const queryClient = useQueryClient();
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [hidden, setHidden] = useState<Priority[]>([]);
  const [occurrence, setOccurrence] = useState<Occurrence | null>(null);
  const [returnDate, setReturnDate] = useState("");

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ settings: Settings }>("/settings"),
  });
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ projects: Project[] }>("/projects"),
  });
  const tasks = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: () => api<{ tasks: Task[] }>("/tasks"),
  });
  const routines = useQuery({
    queryKey: ["routines"],
    queryFn: () => api<{ routines: Routine[] }>("/routines"),
  });
  const blocks = useQuery({
    queryKey: ["calendar", range?.from, range?.to],
    enabled: Boolean(range),
    queryFn: () =>
      api<{ blocks: CalendarBlock[] }>(
        `/calendar?from=${encodeURIComponent(range!.from)}&to=${encodeURIComponent(range!.to)}`,
      ),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(calendarWriteSchema) });
  const routineForm = useForm<RoutineValues>({ resolver: zodResolver(routineWriteSchema) });
  const blockPriority = form.watch("priority") ?? "P3";
  const routinePriority = routineForm.watch("priority") ?? "P3";
  const routineDays = routineForm.watch("daysOfWeek") ?? [];
  const routineInterval = routineForm.watch("intervalWeeks") ?? 1;
  const routineDayTimes = routineForm.watch("dayTimes") ?? {};

  useEffect(() => {
    if (!editor) return;
    const { block, routine, start, end } = editor;
    const occurrenceRoutine = editor.occurrence?.routine;
    const override = occurrenceRoutine?.overrides?.find((item) => item.date === editor.occurrence?.date);
    const startDate = new Date(start);
    const minutes = Math.max(5, Math.round((new Date(end).getTime() - startDate.getTime()) / 60000));
    form.reset({
      title: block?.title ?? override?.title ?? occurrenceRoutine?.name ?? editor.title ?? "",
      type: block?.type ?? override?.type ?? (occurrenceRoutine ? "ROUTINE" : "DEEP_FOCUS"),
      priority: block?.priority ?? override?.priority ?? occurrenceRoutine?.priority ?? "P3",
      startAt: toLocalInput(block?.startAt ?? override?.startAt ?? start),
      endAt: toLocalInput(block?.endAt ?? override?.endAt ?? end),
      projectId: block?.projectId ?? (override ? override.projectId : occurrenceRoutine?.projectId ?? null),
      taskId: block?.taskId ?? override?.taskId ?? null,
      notes: block?.notes ?? (override ? override.notes ?? "" : occurrenceRoutine?.notes ?? ""),
    });
    routineForm.reset({
      name: routine?.name ?? editor.title ?? "",
      type: routine?.type ?? "routine",
      priority: routine?.priority ?? "P3",
      enabled: routine?.enabled ?? true,
      daysOfWeek: routine?.daysOfWeek ?? [startDate.getDay()],
      startTime: routine?.startTime ?? `${pad(startDate.getHours())}:${pad(startDate.getMinutes())}`,
      durationMinutes: routine?.durationMinutes ?? Math.min(minutes, 12 * 60),
      projectId: routine?.projectId ?? null,
      notes: routine?.notes ?? "",
      intervalWeeks: routine?.intervalWeeks ?? 1,
      anchorDate: routine?.anchorDate ?? localDate(startDate),
      dayTimes: routine?.dayTimes ?? {},
    });
  }, [editor, form, routineForm]);

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      queryClient.invalidateQueries({ queryKey: ["routines"] }),
    ]);
  }

  function openCreate(selection?: DateSelectArg) {
    const defaultRange = nextHourRange();
    let start = selection?.start ?? new Date(defaultRange.start);
    let end = selection?.end ?? new Date(defaultRange.end);
    // Clique num dia inteiro (visão de mês): sugere 09:00-10:00 em vez de 24h.
    if (selection?.allDay) {
      start = new Date(selection.start);
      start.setHours(9, 0, 0, 0);
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    setError(null);
    setEditor({ kind: "block", block: null, routine: null, start: start.toISOString(), end: end.toISOString() });
  }

  function switchKind(kind: Editor["kind"]) {
    if (!editor || editor.kind === kind) return;
    const title = (editor.kind === "routine" ? routineForm.getValues("name") : form.getValues("title")) ?? "";
    setEditor({ ...editor, kind, title });
  }

  async function save(values: FormValues) {
    setError(null);
    const body = {
      ...values,
      startAt: new Date(values.startAt).toISOString(),
      endAt: new Date(values.endAt).toISOString(),
      projectId: values.projectId || null,
      taskId: values.taskId || null,
      notes: values.notes || null,
    };
    try {
      if (editor?.occurrence) {
        await api(`/routines/${editor.occurrence.routine.id}/occurrences/${editor.occurrence.date}`, { method: "PUT", body: JSON.stringify(body) });
      } else if (editor?.block) {
        await api(`/calendar/${editor.block.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/calendar", { method: "POST", body: JSON.stringify(body) });
      }
      setEditor(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui salvar o bloco.");
    }
  }

  async function saveRoutine(values: RoutineValues) {
    setError(null);
    // Cada dia marcado guarda seu horário; o primeiro vira o padrão da rotina (cards e listas).
    const days = [...values.daysOfWeek].sort((a, b) => a - b);
    const dayTimes = Object.fromEntries(days.map((day) => [String(day), slotOf(day, values)]));
    const first = days.length ? dayTimes[String(days[0])] : { startTime: values.startTime, durationMinutes: values.durationMinutes };
    const body = {
      ...values,
      ...first,
      dayTimes,
      projectId: values.projectId || null,
      notes: values.notes || null,
    };
    try {
      if (editor?.routine) {
        await api(`/routines/${editor.routine.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await api("/routines", { method: "POST", body: JSON.stringify(body) });
      }
      setEditor(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui salvar a rotina.");
    }
  }

  async function remove() {
    const target = editor?.routine ? `/routines/${editor.routine.id}` : editor?.block ? `/calendar/${editor.block.id}` : null;
    if (!target) return;
    setError(null);
    try {
      await api(target, { method: "DELETE" });
      setEditor(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui apagar.");
    }
  }

  async function move(info: { event: { id: string; start: Date | null; end: Date | null }; revert: () => void }) {
    const end = info.event.end ?? info.event.start;
    if (!info.event.start || !end) return;
    try {
      await api(`/calendar/${info.event.id}`, {
        method: "PATCH",
        body: JSON.stringify({ startAt: info.event.start.toISOString(), endAt: end.toISOString() }),
      });
      await refresh();
    } catch (caught) {
      info.revert();
      setError(caught instanceof ApiError ? caught.message : "Não consegui mover o bloco.");
    }
  }

  async function pause(routine: Routine, startDate: string, endDate: string) {
    setError(null);
    try {
      await api(`/routines/${routine.id}/exceptions`, { method: "POST", body: JSON.stringify({ startDate, endDate }) });
      setOccurrence(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui pausar.");
    }
  }

  async function resume(routine: Routine, exceptionId: string) {
    setError(null);
    try {
      await api(`/routines/${routine.id}/exceptions/${exceptionId}`, { method: "DELETE" });
      setOccurrence(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui retomar.");
    }
  }

  async function cancelOccurrence(routine: Routine, date: string) {
    setError(null);
    try {
      await api(`/routines/${routine.id}/occurrences/${date}`, { method: "DELETE" });
      setOccurrence(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui excluir esta ocorrência.");
    }
  }

  async function restoreOccurrence(routine: Routine, date: string) {
    setError(null);
    try {
      await api(`/routines/${routine.id}/occurrences/${date}/override`, { method: "DELETE" });
      setOccurrence(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui restaurar esta ocorrência.");
    }
  }

  function editOccurrence(occurrence: Occurrence) {
    const { routine, date } = occurrence;
    const override = routine.overrides?.find((item) => item.date === date);
    const day = new Date(`${date}T12:00:00`).getDay();
    const slot = routine.dayTimes?.[String(day)] ?? { startTime: routine.startTime ?? "09:00", durationMinutes: routine.durationMinutes };
    const start = new Date(`${date}T${slot.startTime}:00`);
    const end = new Date(start.getTime() + slot.durationMinutes * 60000);
    setOccurrence(null);
    setEditor({ kind: "block", block: null, routine: null, occurrence, start: override?.startAt ?? start.toISOString(), end: override?.endAt ?? end.toISOString() });
  }

  const visible = (item: { priority: Priority; projectId: string | null }) =>
    !hidden.includes(item.priority) && (!selectedProject || item.projectId === selectedProject);

  // Rotinas são expandidas só para a janela visível (sem materializar no banco); pausas viram fantasmas.
  const visibleDates = range ? { from: localDate(new Date(range.from)), to: localDate(new Date(new Date(range.to).getTime() - 1)) } : null;
  const events = [
    ...(blocks.data?.blocks ?? []).filter(visible).map((block) => ({
      id: block.id,
      title: block.title,
      start: block.startAt,
      end: block.endAt,
      classNames: [`prio-${block.priority}`],
      extendedProps: { kind: "block", priority: block.priority, color: block.project?.color },
    })),
    ...(visibleDates
      ? (routines.data?.routines ?? [])
          .filter((routine) => routine.enabled)
          .flatMap((routine) => {
            const base = (visible(routine) ? expandRoutine({ ...routine, dayTimes: routine.dayTimes ?? {}, intervalWeeks: routine.intervalWeeks ?? 1, anchorDate: routine.anchorDate ?? null }, routine.exceptions ?? [], visibleDates.from, visibleDates.to) : []).flatMap((item) => {
              const override = routine.overrides?.find((entry) => entry.date === item.date);
              if (override && !override.cancelled && !item.paused) return [];
              const start = new Date(`${item.date}T${item.startTime}:00`);
              return {
                id: `routine-${routine.id}-${item.date}`,
                title: routine.name,
                start,
                end: new Date(start.getTime() + item.durationMinutes * 60000),
                editable: false,
                classNames: [`prio-${routine.priority}`, "is-routine", ...(item.paused || override?.cancelled ? ["is-paused"] : [])],
                extendedProps: { kind: "routine", priority: routine.priority, color: routine.project?.color, routineId: routine.id, date: item.date, paused: item.paused || override?.cancelled },
              };
            });
            const edits = (routine.overrides ?? [])
              .filter((item) => !item.cancelled && item.startAt && item.endAt && !routine.exceptions?.some((pause) => pause.startDate <= item.date && item.date <= pause.endDate))
              .filter((item) => !selectedProject || item.projectId === selectedProject)
              .filter((item) => !hidden.includes(item.priority ?? routine.priority))
              .filter((item) => item.startAt! < range!.to && item.endAt! > range!.from)
              .map((item) => ({
                id: `routine-${routine.id}-${item.date}`,
                title: item.title ?? routine.name,
                start: item.startAt!,
                end: item.endAt!,
                editable: false,
                classNames: [`prio-${item.priority ?? routine.priority}`, "is-routine"],
                extendedProps: { kind: "routine", priority: item.priority ?? routine.priority, color: item.project?.color, routineId: routine.id, date: item.date, edited: true },
              }));
            return [...base, ...edits];
          })
      : []),
  ];

  return (
    <div className="grid gap-3 md:gap-4">
      <header className="grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">Calendário</h1>
          <Button onClick={() => openCreate()} className="h-9 px-3.5 text-xs sm:hidden">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <select
            aria-label="Filtrar blocos por projeto"
            className="h-9 min-w-0 flex-1 rounded-xl border border-line bg-panel px-3 text-xs text-ink outline-none transition focus:border-focus cursor-pointer sm:w-48 sm:flex-none"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
          >
            <option value="">Todos os projetos</option>
            {projects.data?.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Filtrar por prioridade">
            {PRIORITIES.map((item) => {
              const off = hidden.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={!off}
                  title={PRIORITY_LABEL[item]}
                  onClick={() => setHidden(off ? hidden.filter((value) => value !== item) : [...hidden, item])}
                  className={cx(
                    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-2 text-xs font-semibold tabular-nums transition-colors duration-150",
                    off ? "border-line bg-transparent text-muted line-through" : "border-line bg-panel text-ink hover:border-focus",
                  )}
                >
                  <span className={cx("h-2 w-2 rounded-full", priorityDot[item], off && "opacity-40")} />
                  {item}
                </button>
              );
            })}
          </div>

          <Button onClick={() => openCreate()} className="hidden h-9 px-4 text-xs sm:inline-flex">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
      </header>

      {error && !editor ? (
        <div className="rounded-xl border border-hot/30 bg-hot/10 px-4 py-2.5 text-xs font-semibold text-hot">
          {error}
        </div>
      ) : null}

      {/* Main Calendar Card */}
      <div
        className="overflow-hidden rounded-2xl border border-line bg-panel p-2 md:p-4 shadow-sm transition"
        data-testid="calendar"
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={isMobile() ? "timeGridDay" : "timeGridWeek"}
          windowResize={(arg) => {
            if (isMobile() && arg.view.type === "timeGridWeek") arg.view.calendar.changeView("timeGridDay");
          }}
          views={{ timeGridWeek: { dayHeaderFormat: { weekday: "short", day: "numeric" } } }}
          eventMinHeight={22}
          eventClassNames={(arg) => {
            const { start, end } = arg.event;
            const mins = start && end ? (end.getTime() - start.getTime()) / 60_000 : 60;
            return mins < 30 ? ["is-compact"] : mins < 60 ? ["is-short"] : [];
          }}
          locale={ptBr}
          firstDay={settings.data?.settings.weekStartsOn ?? 1}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth",
          }}
          buttonText={{ today: "Hoje", month: "Mês", week: "Semana", day: "Dia" }}
          editable
          selectable
          selectMirror
          nowIndicator
          height={isMobile() ? "calc(100dvh - 12.5rem)" : "calc(100dvh - 9.5rem)"}
          allDaySlot={false}
          slotMinTime="05:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          events={events}
          eventDisplay="block"
          eventContent={(arg) => {
            const { kind, priority: prio, color, paused } = arg.event.extendedProps as {
              kind: string;
              priority: Priority;
              color?: string;
              paused?: boolean;
            };
            const [from, ...to] = arg.timeText.split(" - ");
            return (
              <div className="fc-ev" title={arg.timeText ? `${arg.event.title} · ${arg.timeText}` : arg.event.title}>
                <span className="fc-ev-lead">
                  {color ? <span className="fc-ev-project" style={{ background: color }} /> : null}
                  {kind === "routine" ? <Repeat className="h-3 w-3 shrink-0" aria-label="Rotina fixa" /> : null}
                  {paused ? <Pause className="h-3 w-3 shrink-0" aria-label="Pausada" /> : null}
                </span>
                <span className="fc-ev-title">{arg.event.title}</span>
                <span className="fc-ev-time">
                  {from}
                  {to.length ? <span className="fc-ev-end"> – {to.join(" - ")}</span> : null}
                </span>
                <span className="fc-ev-prio">{prio}</span>
              </div>
            );
          }}
          datesSet={(arg) => setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })}
          select={openCreate}
          eventDrop={(info) => void move(info)}
          eventResize={(info) => void move(info)}
          eventClick={(info: EventClickArg) => {
            const id = info.event.id;
            setError(null);
            if (id.startsWith("routine-")) {
              const { routineId, date } = info.event.extendedProps as { routineId: string; date: string };
              const routine = routines.data?.routines.find((item) => item.id === routineId);
              if (routine) setOccurrence({ routine, date });
              return;
            }
            const block = blocks.data?.blocks.find((item) => item.id === id);
            if (block) setEditor({ kind: "block", block, routine: null, start: block.startAt, end: block.endAt });
          }}
        />
      </div>

      {/* Modal Dialog: bloco avulso ou rotina fixa */}
      <Dialog
        open={Boolean(editor)}
        title={editor?.routine ? "Editar rotina fixa" : editor?.occurrence ? "Editar esta ocorrência" : editor?.block ? "Editar bloco" : "Novo item na agenda"}
        subtitle={editor?.kind === "routine" ? "Repete nos dias e horários escolhidos" : editor?.occurrence ? `Só a ocorrência de ${shortDate(editor.occurrence.date)} será alterada` : "Acontece só nesta data"}
        onClose={() => setEditor(null)}
      >
        {editor && !editor.block && !editor.routine && !editor.occurrence ? (
          <div role="tablist" aria-label="Tipo de item" className="mb-3.5 grid grid-cols-2 gap-1.5 rounded-xl bg-panel-2 p-1">
            {([
              ["block", "Só uma vez", CalendarDays],
              ["routine", "Repetir", Repeat],
            ] as const).map(([kind, label, Icon]) => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={editor.kind === kind}
                onClick={() => switchKind(kind)}
                className={cx(
                  "flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors duration-150",
                  editor.kind === kind ? "bg-panel text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {editor?.kind === "routine" ? (
          <form className="grid gap-3.5" data-testid="routine-form" onSubmit={routineForm.handleSubmit(saveRoutine)}>
            <Field label="Nome">
              <input className={controlClass} placeholder="Ex: Academia, Inglês, Revisão do dia..." autoFocus {...routineForm.register("name")} />
            </Field>

            <Field label="Prioridade">
              <PriorityPicker value={routinePriority} onChange={(value) => routineForm.setValue("priority", value)} />
            </Field>

            <div className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Dias</span>
              <div className="flex flex-wrap gap-1.5">
                {days.map((day) => {
                  const on = routineDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        routineForm.setValue(
                          "daysOfWeek",
                          on ? routineDays.filter((value) => value !== day.value) : [...routineDays, day.value],
                        )
                      }
                      className={cx(
                        "min-h-11 min-w-11 cursor-pointer rounded-xl border px-2 text-xs font-semibold transition-colors duration-150",
                        on ? "border-focus bg-focus text-white" : "border-line bg-panel-2/60 text-muted hover:text-ink",
                      )}
                    >
                      {day.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="min-h-11 cursor-pointer rounded-xl px-2 text-xs font-semibold text-focus"
                  onClick={() => routineForm.setValue("daysOfWeek", [0, 1, 2, 3, 4, 5, 6])}
                >
                  Todo dia
                </button>
              </div>
            </div>

            <div className="grid gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted">Horário de cada dia</span>
              {days
                .filter((day) => routineDays.includes(day.value))
                .map((day) => {
                  const slot = slotOf(day.value, routineForm.getValues());
                  const set = (patch: Partial<typeof slot>) =>
                    routineForm.setValue("dayTimes", { ...routineDayTimes, [String(day.value)]: { ...slot, ...patch } }, { shouldValidate: true });
                  return (
                    <div key={day.value} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2">
                      <span className="text-xs font-semibold text-ink">{day.label}</span>
                      <input aria-label={`Início ${day.label}`} className={controlClass} type="time" value={slot.startTime} onChange={(event) => set({ startTime: event.target.value })} />
                      <input aria-label={`Duração ${day.label} (min)`} className={controlClass} type="number" min={5} step={5} value={slot.durationMinutes} onChange={(event) => set({ durationMinutes: Number(event.target.value) })} />
                    </div>
                  );
                })}
              {routineDays.length === 0 ? <p className="text-xs text-muted">Marque ao menos um dia.</p> : <p className="text-xs text-muted">Início e duração em minutos, por dia.</p>}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Repetir">
                <select className={controlClass} {...routineForm.register("intervalWeeks", { valueAsNumber: true })}>
                  {Object.entries(INTERVAL_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {routineInterval > 1 ? (
                <Field label="Contar a partir de">
                  <input className={controlClass} type="date" {...routineForm.register("anchorDate")} />
                </Field>
              ) : null}
            </div>

            <Field label="Projeto vinculado">
              <select className={controlClass} {...routineForm.register("projectId", { setValueAs: (value) => value || null })}>
                <option value="">Nenhum</option>
                {projects.data?.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notas">
              <textarea className={controlClass} rows={2} {...routineForm.register("notes")} />
            </Field>

            {routineForm.formState.errors.name ? (
              <p className="text-xs font-semibold text-hot">{routineForm.formState.errors.name.message}</p>
            ) : null}
            {routineForm.formState.errors.durationMinutes || routineForm.formState.errors.dayTimes ? (
              <p className="text-xs font-semibold text-hot">Duração entre 5 e 720 minutos.</p>
            ) : null}
            {error ? <p className="text-xs font-semibold text-hot">{error}</p> : null}

            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
              <Button type="submit">Salvar rotina</Button>
              <Button type="button" variant="quiet" onClick={() => setEditor(null)}>
                Cancelar
              </Button>
              {editor.routine ? (
                <Button type="button" variant="danger" className="ml-auto" onClick={() => void remove()}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Apagar rotina
                </Button>
              ) : null}
            </div>
          </form>
        ) : (
          <form className="grid gap-3.5" data-testid="calendar-form" onSubmit={form.handleSubmit(save)}>
            <Field label="Título">
              <input className={controlClass} placeholder="Ex: Foco na arquitetura da API..." autoFocus {...form.register("title")} />
            </Field>

            <Field label="Prioridade">
              <PriorityPicker value={blockPriority} onChange={(value) => form.setValue("priority", value)} />
            </Field>

            <Field label="Tipo">
              <select className={controlClass} {...form.register("type")}>
                {CALENDAR_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CALENDAR_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Início">
                <input className={controlClass} type="datetime-local" {...form.register("startAt")} />
              </Field>
              <Field label="Término">
                <input className={controlClass} type="datetime-local" {...form.register("endAt")} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Projeto vinculado">
                <select className={controlClass} {...form.register("projectId", { setValueAs: (value) => value || null })}>
                  <option value="">Nenhum</option>
                  {projects.data?.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Tarefa vinculada">
                <select className={controlClass} {...form.register("taskId", { setValueAs: (value) => value || null })}>
                  <option value="">Nenhuma</option>
                  {tasks.data?.tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Notas">
              <textarea className={controlClass} rows={3} placeholder="Anotações de preparação..." {...form.register("notes")} />
            </Field>

            {form.formState.errors.title ? (
              <p className="text-xs font-semibold text-hot">{form.formState.errors.title.message}</p>
            ) : null}
            {form.formState.errors.endAt ? (
              <p className="text-xs font-semibold text-hot">{form.formState.errors.endAt.message}</p>
            ) : null}
            {error ? <p className="text-xs font-semibold text-hot">{error}</p> : null}

            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
              <Button type="submit">{editor?.occurrence ? "Salvar esta ocorrência" : "Salvar bloco"}</Button>
              <Button type="button" variant="quiet" onClick={() => setEditor(null)}>
                Cancelar
              </Button>
              {editor?.block ? (
                <Button type="button" variant="danger" className="ml-auto" onClick={() => void remove()}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Apagar
                </Button>
              ) : null}
            </div>
          </form>
        )}
      </Dialog>

      {/* Ações por data sem alterar a série. */}
      <Dialog
        open={Boolean(occurrence)}
        title={occurrence?.routine.name ?? ""}
        subtitle={occurrence ? `Ocorrência de ${shortDate(occurrence.date)}` : ""}
        onClose={() => setOccurrence(null)}
      >
        {occurrence
          ? (() => {
              const { routine, date } = occurrence;
              const pauseHere = routine.exceptions?.find((item) => item.startDate <= date && date <= item.endDate);
              const single = pauseHere && pauseHere.startDate === pauseHere.endDate;
              const override = routine.overrides?.find((item) => item.date === date);
              return (
                <div className="grid gap-3.5" data-testid="occurrence-menu">
                  {override?.cancelled && !pauseHere ? (
                    <>
                      <p className="text-xs text-muted">Excluída só nesta data. As próximas ocorrências continuam.</p>
                      <Button type="button" onClick={() => void restoreOccurrence(routine, date)}>
                        <Play className="h-3.5 w-3.5" />
                        Reativar este dia
                      </Button>
                    </>
                  ) : pauseHere ? (
                    <>
                      <p className="text-xs text-muted">
                        {single ? `Pulada em ${shortDate(pauseHere.startDate)}.` : `Pausada de ${shortDate(pauseHere.startDate)} até ${shortDate(pauseHere.endDate)}.`}{" "}
                        A série original continua intacta.
                      </p>
                      <Button type="button" onClick={() => void resume(routine, pauseHere.id)}>
                        <Play className="h-3.5 w-3.5" />
                        {single ? "Reativar este dia" : "Retomar a série agora"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button type="button" onClick={() => editOccurrence(occurrence)}>
                        Editar só este dia
                      </Button>
                      {override ? <Button type="button" variant="quiet" onClick={() => void restoreOccurrence(routine, date)}>Restaurar original</Button> : null}
                      <Button type="button" variant="danger" onClick={() => void cancelOccurrence(routine, date)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir só este dia
                      </Button>
                      <div className="grid gap-2 rounded-xl border border-line p-3">
                        <Field label="Pausar até voltar em">
                          <input className={controlClass} type="date" min={addDays(date, 1)} value={returnDate} onChange={(event) => setReturnDate(event.target.value)} />
                        </Field>
                        <Button type="button" variant="quiet" disabled={!returnDate || returnDate <= date} onClick={() => void pause(routine, date, addDays(returnDate, -1))}>
                          Pausar até essa data
                        </Button>
                      </div>
                    </>
                  )}
                  {error ? <p className="text-xs font-semibold text-hot">{error}</p> : null}
                  <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
                    <Button
                      type="button"
                      variant="quiet"
                      onClick={() => {
                        const start = new Date(`${date}T${(routine.dayTimes?.[String(new Date(`${date}T12:00:00`).getDay())]?.startTime ?? routine.startTime ?? "09:00")}:00`);
                        setOccurrence(null);
                        setEditor({ kind: "routine", block: null, routine, start: start.toISOString(), end: start.toISOString() });
                      }}
                    >
                      Editar a série
                    </Button>
                  </div>
                </div>
              );
            })()
          : null}
      </Dialog>
    </div>
  );
}
