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
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { CALENDAR_TYPES, CALENDAR_TYPE_LABEL, calendarWriteSchema } from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Dialog, Field, controlClass } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import type { CalendarBlock, Project, Settings, Task } from "../../types";

type FormValues = z.infer<typeof calendarWriteSchema>;
type Editor = { mode: "create"; start: string; end: string } | { mode: "edit"; block: CalendarBlock };

const typeColor: Record<string, string> = {
  DEEP_FOCUS: "#2563eb",
  TASK: "#d97706",
  ROUTINE: "#059669",
  MEETING: "#dc2626",
  PERSONAL: "#7c3aed",
};

function toLocalInput(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
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
  const blocks = useQuery({
    queryKey: ["calendar", range?.from, range?.to],
    enabled: Boolean(range),
    queryFn: () =>
      api<{ blocks: CalendarBlock[] }>(
        `/calendar?from=${encodeURIComponent(range!.from)}&to=${encodeURIComponent(range!.to)}`,
      ),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(calendarWriteSchema) });

  useEffect(() => {
    if (!editor) return;
    const start = editor.mode === "create" ? editor.start : editor.block.startAt;
    const end = editor.mode === "create" ? editor.end : editor.block.endAt;
    const block = editor.mode === "edit" ? editor.block : null;
    form.reset({
      title: block?.title ?? "",
      type: block?.type ?? "DEEP_FOCUS",
      startAt: toLocalInput(start),
      endAt: toLocalInput(end),
      projectId: block?.projectId ?? null,
      taskId: block?.taskId ?? null,
      notes: block?.notes ?? "",
    });
  }, [editor, form]);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["calendar"] });
  }

  function openCreate(selection?: DateSelectArg) {
    const defaultRange = nextHourRange();
    const start = selection?.start.toISOString() ?? defaultRange.start;
    const end = selection?.end.toISOString() ?? defaultRange.end;
    setError(null);
    setEditor({ mode: "create", start, end });
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
      if (editor?.mode === "edit") {
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

  async function remove() {
    if (editor?.mode !== "edit") return;
    setError(null);
    try {
      await api(`/calendar/${editor.block.id}`, { method: "DELETE" });
      setEditor(null);
      await refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui apagar o bloco.");
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

  // Filter blocks by project if chosen
  const displayedBlocks = (blocks.data?.blocks ?? []).filter((block) => {
    if (!selectedProject) return true;
    return block.projectId === selectedProject;
  });

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
            Planejamento visual de tempo. Clique no intervalo desejado para reservar blocos de foco.
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
            Novo bloco
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
          slotMinTime="07:00:00"
          slotMaxTime="22:00:00"
          slotDuration="00:30:00"
          scrollTime="08:00:00"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          events={displayedBlocks.map((block) => {
            const color = block.project?.color ?? typeColor[block.type];
            return {
              id: block.id,
              title: block.title,
              start: block.startAt,
              end: block.endAt,
              backgroundColor: `color-mix(in srgb, ${color} 24%, var(--panel))`,
              borderColor: color,
              textColor: "var(--ink)",
            };
          })}
          datesSet={(arg) => setRange({ from: arg.start.toISOString(), to: arg.end.toISOString() })}
          select={openCreate}
          eventDrop={(info) => void move(info)}
          eventResize={(info) => void move(info)}
          eventClick={(info: EventClickArg) => {
            const block = blocks.data?.blocks.find((item) => item.id === info.event.id);
            if (block) {
              setError(null);
              setEditor({ mode: "edit", block });
            }
          }}
        />
      </div>

      {/* Modal Dialog for Block Create & Edit */}
      <Dialog
        open={Boolean(editor)}
        title={editor?.mode === "edit" ? "Editar Bloco de Agenda" : "Novo Bloco de Agenda"}
        subtitle="Agende horários para foco profundo, reuniões ou tarefas"
        onClose={() => setEditor(null)}
      >
        <form
          className="grid gap-3.5"
          data-testid="calendar-form"
          onSubmit={form.handleSubmit(save)}
        >
          <Field label="Título do Bloco">
            <input
              className={controlClass}
              placeholder="Ex: Foco na arquitetura da API..."
              autoFocus
              {...form.register("title")}
            />
          </Field>

          <Field label="Tipo do Bloco">
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
            <Field label="Projeto Vinculado">
              <select
                className={controlClass}
                {...form.register("projectId", { setValueAs: (value) => value || null })}
              >
                <option value="">Nenhum</option>
                {projects.data?.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tarefa Vinculada">
              <select
                className={controlClass}
                {...form.register("taskId", { setValueAs: (value) => value || null })}
              >
                <option value="">Nenhuma</option>
                {tasks.data?.tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notas & Objetivos">
            <textarea
              className={controlClass}
              rows={3}
              placeholder="Anotações de preparação..."
              {...form.register("notes")}
            />
          </Field>

          {form.formState.errors.title ? (
            <p className="text-xs font-semibold text-hot">{form.formState.errors.title.message}</p>
          ) : null}
          {form.formState.errors.endAt ? (
            <p className="text-xs font-semibold text-hot">{form.formState.errors.endAt.message}</p>
          ) : null}
          {error ? <p className="text-xs font-semibold text-hot">{error}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
            <Button type="submit">Salvar Bloco</Button>
            <Button type="button" variant="quiet" onClick={() => setEditor(null)}>
              Cancelar
            </Button>
            {editor?.mode === "edit" ? (
              <Button
                type="button"
                variant="danger"
                className="ml-auto"
                onClick={() => void remove()}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Apagar
              </Button>
            ) : null}
          </div>
        </form>
      </Dialog>
    </div>
  );
}
