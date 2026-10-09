import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  ENERGY_LABEL,
  ENERGY_LEVELS,
  PRIORITIES,
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  taskWriteSchema,
  type TaskStatus,
} from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Dialog, Field, controlClass } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import type { Project, Task } from "../../types";

type FormValues = z.infer<typeof taskWriteSchema>;

export type TaskDraft =
  | { mode: "create"; status: TaskStatus; projectId?: string | null }
  | { mode: "edit"; task: Task };

function empty(status: TaskStatus, projectId?: string | null): FormValues {
  return {
    title: "",
    description: "",
    status,
    priority: "P3",
    energy: "MEDIUM",
    aversion: "LOW",
    projectId: projectId ?? null,
    estimatedMinutes: null,
    dueDate: null,
    nextAction: "",
    externalCommitment: false,
    blocked: false,
    blockReason: "",
  };
}

function fromTask(task: Task): FormValues {
  return {
    title: task.title,
    description: task.description ?? "",
    status: task.status,
    priority: task.priority,
    energy: task.energy,
    aversion: task.aversion,
    projectId: task.projectId,
    estimatedMinutes: task.estimatedMinutes,
    dueDate: task.dueDate ? task.dueDate.slice(0, 10) : null,
    nextAction: task.nextAction ?? "",
    externalCommitment: task.externalCommitment,
    blocked: task.blocked,
    blockReason: task.blockReason ?? "",
  };
}

export function TaskDialog({
  draft,
  projects,
  onClose,
  onSaved,
}: {
  draft: TaskDraft | null;
  projects: Project[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [needsReplace, setNeedsReplace] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(taskWriteSchema), defaultValues: empty("INBOX") });

  useEffect(() => {
    setError(null);
    setNeedsReplace(false);
    if (!draft) return;
    form.reset(draft.mode === "create" ? empty(draft.status, draft.projectId) : fromTask(draft.task));
  }, [draft, form]);

  async function save(values: FormValues, confirmReplace = false) {
    if (!draft) return;
    setError(null);
    const body = {
      ...values,
      description: values.description || null,
      nextAction: values.nextAction || null,
      blockReason: values.blockReason || null,
      projectId: values.projectId || null,
      dueDate: values.dueDate || null,
      confirmReplace,
    };
    try {
      if (draft.mode === "create") {
        await api("/tasks", { method: "POST", body: JSON.stringify(body) });
      } else {
        await api(`/tasks/${draft.task.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      onClose();
      await onSaved();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "DOING_LIMIT_REACHED") {
        setNeedsReplace(true);
        setError(caught.message);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Não consegui salvar a tarefa.");
    }
  }

  async function remove() {
    if (draft?.mode !== "edit") return;
    setError(null);
    try {
      await api(`/tasks/${draft.task.id}`, { method: "DELETE" });
      onClose();
      await onSaved();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não consegui apagar a tarefa.");
    }
  }

  const isEdit = draft?.mode === "edit";

  return (
    <Dialog
      open={Boolean(draft)}
      title={isEdit ? "Editar Tarefa" : "Nova Tarefa"}
      subtitle={isEdit ? "Ajuste os detalhes, estimativas ou movimente a tarefa" : "Crie um novo item na sua rotina"}
      onClose={onClose}
    >
      <form className="flex min-h-0 flex-col" onSubmit={form.handleSubmit((values) => save(values))}>
        <div className="grid min-h-0 gap-4 overflow-y-auto pr-1">
          {/* Main Info */}
          <div className="grid gap-3">
            <Field label="Título">
              <input
                className={controlClass}
                placeholder="Ex: Refatorar fluxo de checkout..."
                autoFocus
                {...form.register("title")}
              />
            </Field>

            <Field label="Próximo Passo / Ação Imediata" hint="O que você precisa fazer primeiro?">
              <input
                className={controlClass}
                placeholder="Ex: Abrir arquivo do schema e validar tipos"
                {...form.register("nextAction")}
              />
            </Field>

            <Field label="Descrição Detalhada">
              <textarea
                className={controlClass}
                rows={3}
                placeholder="Contexto, links ou notas de apoio..."
                {...form.register("description")}
              />
            </Field>
          </div>

          {/* Classification Row */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Coluna / Status">
              <select className={controlClass} {...form.register("status")}>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prioridade">
              <select className={controlClass} {...form.register("priority")}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Projeto">
              <select className={controlClass} {...form.register("projectId", { setValueAs: (value) => value || null })}>
                <option value="">Sem projeto</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Estimativa (minutos)">
              <input
                className={controlClass}
                type="number"
                min={1}
                placeholder="Ex: 45"
                {...form.register("estimatedMinutes", {
                  setValueAs: (value) => (value === "" || value == null ? null : Number(value)),
                })}
              />
            </Field>
          </div>

          {/* Energy & Deadlines */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nível de Energia">
              <select className={controlClass} {...form.register("energy")}>
                {ENERGY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {ENERGY_LABEL[level]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Aversão / Resistência">
              <select className={controlClass} {...form.register("aversion")}>
                {ENERGY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {ENERGY_LABEL[level]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prazo Final">
              <input
                className={controlClass}
                type="date"
                {...form.register("dueDate", { setValueAs: (value) => value || null })}
              />
            </Field>
          </div>

          {/* Flags and blockers */}
          <div className="rounded-xl border border-line bg-panel-2/50 p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line text-focus focus:ring-focus/20"
                  {...form.register("externalCommitment")}
                />
                Compromisso externo
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-ink cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-line text-focus focus:ring-focus/20"
                  {...form.register("blocked")}
                />
                Tarefa bloqueada
              </label>
            </div>

            {form.watch("blocked") ? (
              <Field label="Motivo do Bloqueio">
                <input
                  className={controlClass}
                  placeholder="Ex: Aguardando resposta do cliente ou liberação de acesso..."
                  {...form.register("blockReason")}
                />
              </Field>
            ) : null}
          </div>

          {/* Errors */}
          {form.formState.errors.title ? (
            <p className="text-xs font-semibold text-hot">{form.formState.errors.title.message}</p>
          ) : null}
          {error ? <p className="text-xs font-semibold text-hot">{error}</p> : null}
        </div>

        {/* Footer actions */}
        <div className="mt-4 flex shrink-0 flex-wrap items-center gap-2 border-t border-line/60 pt-4">
          <Button type="submit">Salvar Tarefa</Button>
          {needsReplace ? (
            <Button type="button" variant="ghost" onClick={form.handleSubmit((values) => save(values, true))}>
              Trocar a tarefa em execução
            </Button>
          ) : null}
          <Button type="button" variant="quiet" onClick={onClose}>
            Cancelar
          </Button>
          {isEdit ? (
            <Button type="button" variant="danger" className="ml-auto" onClick={() => void remove()}>
              Apagar Tarefa
            </Button>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
