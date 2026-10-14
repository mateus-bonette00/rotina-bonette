import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";
import ptBr from "@fullcalendar/core/locales/pt-br";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar as CalendarIcon,
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
};

// Ocorrência de uma rotina clicada no calendário: pular dia, pausar período ou retomar.
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
    const startDate = new Date(start);
    const minutes = Math.max(5, Math.round((new Date(end).getTime() - startDate.getTime()) / 60000));
    form.reset({
      title: block?.title ?? editor.title ?? "",
      type: block?.type ?? "DEEP_FOCUS",
      priority: block?.priority ?? "P3",
      startAt: toLocalInput(block?.startAt ?? start),
      endAt: toLocalInput(block?.endAt ?? end),
      projectId: block?.projectId ?? null,
      taskId: block?.taskId ?? null,
      notes: block?.notes ?? "",
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
      if (editor?.block) {
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
          .filter((routine) => routine.enabled && visible(routine))
          .flatMap((routine) =>
            expandRoutine({ ...routine, dayTimes: routine.dayTimes ?? {}, intervalWeeks: routine.intervalWeeks ?? 1, anchorDate: routine.anchorDate ?? null }, routine.exceptions ?? [], visibleDates.from, visibleDates.to).map((item) => {
              const start = new Date(`${item.date}T${item.startTime}:00`);
              return {
                id: `routine-${routine.id}-${item.date}`,
                title: routine.name,
                start,
                end: new Date(start.getTime() + item.durationMinutes * 60000),
                editable: false,
                classNames: [`prio-${routine.priority}`, "is-routine", ...(item.paused ? ["is-paused"] : [])],
                extendedProps: { kind: "routine", priority: routine.priority, color: routine.project?.color, routineId: routine.id, date: item.date, paused: item.paused },
              };
            }),
          )
      : []),
  ];

  return (
    <div className="grid gap-5">
      {/* Refined Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-focus/15 text-focus">
              <CalendarIcon className="h-4 w-4" />
            </span>
            <h1 className="page-title">Calendário & Agenda</h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            Arraste no calendário para criar. Clique numa rotina para pular um dia, pausar até uma data ou editar a série; o destaque do card segue a prioridade.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Project filter */}
          <select
            aria-label="Filtrar blocos por projeto"
            className="h-9.5 rounded-xl border border-line bg-panel px-3 text-xs text-ink outline-none transition focus:border-focus cursor-pointer"
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

          {/* New Block Button */}
          <Button onClick={() => openCreate()} className="h-9.5 px-4 text-xs">
            <Plus className="h-4 w-4" />
            Novo
          </Button>
        </div>
      </header>

      {/* Legenda = filtro de prioridade */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por prioridade">
        {PRIORITIES.map((item) => {
          const off = hidden.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={!off}
              onClick={() => setHidden(off ? hidden.filter((value) => value !== item) : [...hidden, item])}
              className={cx(
                "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors duration-150",
                off ? "border-line bg-transparent text-muted line-through" : "border-line bg-panel text-ink hover:border-focus",
              )}
            >
              <span className={cx("h-2.5 w-2.5 rounded-full", priorityDot[item], off && "opacity-40")} />
              {PRIORITY_LABEL[item]}
            </button>
          );
        })}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted">
          <Repeat className="h-3.5 w-3.5" /> = rotina fixa
        </span>
      </div>

      {error && !editor ? (
        <div className="rounded-xl border border-hot/30 bg-hot/10 px-4 py-2.5 text-xs font-semibold text-hot">
          {error}
        </div>
      ) : null}

      {/* Main Calendar Card */}
      <div
        className="overflow-hidden rounded-2xl border border-line bg-panel p-3 md:p-5 shadow-sm transition"
        data-testid="calendar"
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
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
          height="calc(100dvh - 14rem)"
          allDaySlot={false}
          slotMinTime="05:00:00"
          slotMaxTime="24:00:00"
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          events={events}
          eventDisplay="block"
          eventContent={(arg) => {
            const { kind, priority: prio, color } = arg.event.extendedProps as {
              kind: string;
              priority: Priority;
              color?: string;
            };
            return (
              <div className="fc-ev">
                <div className="fc-ev-meta">
                  {color ? <span className="fc-ev-project" style={{ background: color }} /> : null}
                  {kind === "routine" ? <Repeat className="h-3 w-3 shrink-0" aria-label="Rotina fixa" /> : null}
                  {(arg.event.extendedProps as { paused?: boolean }).paused ? <Pause className="h-3 w-3 shrink-0" aria-label="Pausada" /> : null}
                  <span className="fc-ev-time">{arg.timeText}</span>
                  <span className="fc-ev-prio">{prio}</span>
                </div>
                <div className="fc-ev-title">{arg.event.title}</div>
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
        title={editor?.routine ? "Editar rotina fixa" : editor?.block ? "Editar bloco" : "Novo item na agenda"}
        subtitle={editor?.kind === "routine" ? "Repete nos dias e horários escolhidos" : "Acontece só nesta data"}
        onClose={() => setEditor(null)}
      >
        {editor && !editor.block && !editor.routine ? (
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
              <Button type="submit">Salvar bloco</Button>
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

      {/* Ocorrência de rotina: a série original nunca é alterada, só ganha pausas. */}
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
              return (
                <div className="grid gap-3.5" data-testid="occurrence-menu">
                  {pauseHere ? (
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
                      <Button type="button" onClick={() => void pause(routine, date, date)}>
                        <Pause className="h-3.5 w-3.5" />
                        Pular só este dia
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
