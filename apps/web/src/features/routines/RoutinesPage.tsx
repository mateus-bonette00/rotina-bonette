import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Pencil,
  Plus,
  Power,
  Repeat,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { routineWriteSchema } from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Dialog, Field, controlClass } from "../../components/ui";
import { api } from "../../lib/api";
import { cx } from "../../lib/format";
import type { Project, Routine } from "../../types";

const days = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

type FormValues = z.infer<typeof routineWriteSchema>;

export function RoutinesPage() {
  const queryClient = useQueryClient();
  const routines = useQuery({ queryKey: ["routines"], queryFn: () => api<{ routines: Routine[] }>("/routines") });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<{ projects: Project[] }>("/projects") });
  const [editing, setEditing] = useState<Routine | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(routineWriteSchema),
    defaultValues: { name: "", daysOfWeek: [1, 2, 3, 4, 5], durationMinutes: 30, type: "review", enabled: true, startTime: "09:00" },
  });
  const editForm = useForm<FormValues>({ resolver: zodResolver(routineWriteSchema) });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["routines"] });
  }

  return (
    <div className="grid gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-focus/15 text-focus">
              <Repeat className="h-4 w-4" />
            </span>
            <h1 className="page-title">Rotinas Recorrentes</h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            Hábitos e blocos que se repetem durante a semana para manter a consistência do seu dia.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="h-9.5 px-4 text-xs">
          <Plus className="h-4 w-4" />
          Nova rotina
        </Button>
      </header>

      {/* Routines Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {routines.data?.routines.map((routine) => (
          <div
            key={routine.id}
            className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 shadow-sm transition hover:border-line/80 hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="font-mono">{routine.startTime ?? "Sem horário"}</span>
                  <span>·</span>
                  <span>{routine.durationMinutes} min</span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    api(`/routines/${routine.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ enabled: !routine.enabled }),
                    }).then(refresh)
                  }
                  className={cx(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition cursor-pointer",
                    routine.enabled
                      ? "bg-ok/10 text-ok border border-ok/25"
                      : "bg-panel-2 text-muted border border-line",
                  )}
                >
                  <Power className="h-3 w-3" />
                  {routine.enabled ? "Ativa" : "Pausada"}
                </button>
              </div>

              <h2 className="text-base font-bold text-ink">{routine.name}</h2>
              {routine.project ? (
                <p className="text-xs text-muted mt-0.5">{routine.project.name}</p>
              ) : null}

              {/* Days of week pill selector */}
              <div className="mt-4 flex flex-wrap gap-1">
                {days.map((day) => {
                  const on = routine.daysOfWeek.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      aria-label={`Dia ${day.value}`}
                      className={cx(
                        "h-7 min-w-7 rounded-lg text-[11px] font-semibold border transition cursor-pointer px-1.5",
                        on
                          ? "border-focus bg-focus text-white shadow-xs"
                          : "border-line bg-panel-2/60 text-muted hover:text-ink",
                      )}
                      onClick={() => {
                        const next = on
                          ? routine.daysOfWeek.filter((value) => value !== day.value)
                          : [...routine.daysOfWeek, day.value];
                        void api(`/routines/${routine.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ daysOfWeek: next }),
                        }).then(refresh);
                      }}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line/60 pt-3">
              <Button
                variant="ghost"
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  setEditing(routine);
                  editForm.reset({
                    name: routine.name,
                    projectId: routine.projectId,
                    enabled: routine.enabled,
                    daysOfWeek: routine.daysOfWeek,
                    startTime: routine.startTime ?? "09:00",
                    durationMinutes: routine.durationMinutes,
                    type: routine.type,
                    notes: routine.notes ?? "",
                  });
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>

              <Button
                variant="danger"
                className="h-8 w-8 p-0"
                onClick={() => api(`/routines/${routine.id}`, { method: "DELETE" }).then(refresh)}
                title="Apagar rotina"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {routines.data?.routines.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <Repeat className="mx-auto h-8 w-8 text-muted/50 mb-2" />
          <p className="text-sm font-semibold text-ink">Nenhuma rotina configurada</p>
          <p className="text-xs text-muted mt-1">Crie blocos recorrentes para planejar suas semanas com previsibilidade.</p>
        </div>
      ) : null}

      {/* Edit Routine Modal */}
      <Dialog open={Boolean(editing)} title="Editar Rotina" subtitle="Ajuste o cronograma recorrente" onClose={() => setEditing(null)}>
        <form
          className="grid gap-3.5"
          onSubmit={editForm.handleSubmit(async (values) => {
            if (!editing) return;
            await api(`/routines/${editing.id}`, {
              method: "PATCH",
              body: JSON.stringify({ ...values, projectId: values.projectId || null, notes: values.notes || null }),
            });
            setEditing(null);
            await refresh();
          })}
        >
          <Field label="Nome da Rotina">
            <input className={controlClass} autoFocus {...editForm.register("name")} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Duração (minutos)">
              <input type="number" className={controlClass} {...editForm.register("durationMinutes", { valueAsNumber: true })} />
            </Field>
            <Field label="Horário de Início">
              <input className={controlClass} type="time" {...editForm.register("startTime")} />
            </Field>
          </div>

          <Field label="Projeto Vinculado">
            <select className={controlClass} {...editForm.register("projectId", { setValueAs: (value) => value || null })}>
              <option value="">Nenhum</option>
              {projects.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notas">
            <textarea className={controlClass} rows={2} {...editForm.register("notes")} />
          </Field>

          <div className="mt-2 flex items-center gap-2 border-t border-line/60 pt-3">
            <Button type="submit">Salvar Rotina</Button>
            <Button type="button" variant="quiet" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Create Routine Modal */}
      <Dialog open={isCreating} title="Nova Rotina" subtitle="Configure um novo compromisso recorrente" onClose={() => setIsCreating(false)}>
        <form
          className="grid gap-3.5"
          onSubmit={form.handleSubmit(async (values) => {
            await api("/routines", { method: "POST", body: JSON.stringify({ ...values, projectId: values.projectId || null }) });
            form.reset();
            setIsCreating(false);
            await refresh();
          })}
        >
          <Field label="Nome da Rotina">
            <input className={controlClass} placeholder="Ex: Revisão diária matinal..." autoFocus {...form.register("name")} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Duração (minutos)">
              <input type="number" className={controlClass} {...form.register("durationMinutes", { valueAsNumber: true })} />
            </Field>
            <Field label="Horário de Início">
              <input className={controlClass} type="time" {...form.register("startTime")} />
            </Field>
          </div>

          <Field label="Projeto Vinculado">
            <select className={controlClass} {...form.register("projectId", { setValueAs: (value) => value || null })}>
              <option value="">Nenhum</option>
              {projects.data?.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="mt-2 flex items-center gap-2 border-t border-line/60 pt-3">
            <Button type="submit">Adicionar Rotina</Button>
            <Button type="button" variant="quiet" onClick={() => setIsCreating(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
