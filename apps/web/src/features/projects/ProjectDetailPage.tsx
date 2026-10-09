import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowLeft,
  Folder,
  Pause,
  Play,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CATEGORY_LABEL,
  PRIORITIES,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  projectWriteSchema,
} from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Card, Dialog, Field, PriorityBadge, controlClass } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import type { Project, Task } from "../../types";
import { TaskDialog, type TaskDraft } from "../tasks/TaskDialog";

type FormValues = z.infer<typeof projectWriteSchema>;
type Detail = Project & { tasks: Task[]; blocks: Array<{ id: string; title: string; startAt: string }> };

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [taskDraft, setTaskDraft] = useState<TaskDraft | null>(null);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<{ projects: Project[] }>("/projects") });
  const [message, setMessage] = useState<string | null>(null);
  const [activeChoices, setActiveChoices] = useState<Array<{ id: string; name: string }>>([]);

  const project = useQuery({
    queryKey: ["project", id],
    queryFn: () => api<{ project: Detail }>(`/projects/${id}`),
  });

  const form = useForm<FormValues>({ resolver: zodResolver(projectWriteSchema) });

  useEffect(() => {
    const current = project.data?.project;
    if (!current) return;
    form.reset({
      name: current.name,
      description: current.description,
      color: current.color,
      icon: current.icon,
      status: current.status,
      priority: current.priority,
      category: current.category,
      progress: current.progress,
      notes: current.notes ?? "",
      deadline: current.deadline ? current.deadline.slice(0, 10) : null,
    });
  }, [project.data, form]);

  async function save(values: FormValues) {
    try {
      await api(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...values, notes: values.notes || null, deadline: values.deadline || null }),
      });
      setMessage("Alterações salvas com sucesso.");
      await queryClient.invalidateQueries();
    } catch (error) {
      if (error instanceof ApiError && error.code === "ACTIVE_PROJECT_LIMIT_REACHED") {
        setActiveChoices((error.details.active as Array<{ id: string; name: string }>) ?? []);
        return;
      }
      setMessage(error instanceof ApiError ? error.message : "Não foi possível salvar.");
    }
  }

  async function activate(parkProjectId?: string) {
    try {
      await api(`/projects/${id}/activate`, { method: "POST", body: JSON.stringify({ parkProjectId }) });
      setActiveChoices([]);
      await queryClient.invalidateQueries();
    } catch (error) {
      if (error instanceof ApiError && error.code === "ACTIVE_PROJECT_LIMIT_REACHED") {
        setActiveChoices((error.details.active as Array<{ id: string; name: string }>) ?? []);
        return;
      }
      setMessage(error instanceof ApiError ? error.message : "Não foi possível ativar.");
    }
  }

  const current = project.data?.project;
  if (!current) return <p className="text-muted p-8 text-sm">Carregando projeto…</p>;

  return (
    <div className="grid gap-6">
      {/* Back button and quick actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/projetos"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted hover:text-ink transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos projetos
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {current.status !== "ACTIVE" ? (
            <Button onClick={() => activate()} className="h-9 px-3.5 text-xs">
              <Play className="h-3.5 w-3.5" />
              Ativar no Foco
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => api(`/projects/${id}/park`, { method: "POST", body: "{}" }).then(() => queryClient.invalidateQueries())}
              className="h-9 px-3.5 text-xs"
            >
              <Pause className="h-3.5 w-3.5" />
              Estacionar
            </Button>
          )}

          <Button
            variant="danger"
            onClick={() =>
              api(`/projects/${id}`, { method: "DELETE" }).then(() => {
                navigate("/projetos");
              })
            }
            className="h-9 px-3.5 text-xs"
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivar
          </Button>
        </div>
      </div>

      {/* Project Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span
              className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white shadow-md text-xl"
              style={{ backgroundColor: current.color }}
            >
              <Folder className="h-7 w-7" />
            </span>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-ink">{current.name}</h1>
                <PriorityBadge priority={current.priority} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {CATEGORY_LABEL[current.category]} · Status:{" "}
                <span className="font-semibold text-ink">{PROJECT_STATUS_LABEL[current.status]}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] font-medium text-muted">Progresso geral</span>
              <p className="font-mono text-xl font-bold text-ink tabular-nums">{current.progress}%</p>
            </div>
          </div>
        </div>

        {/* Progress bar in hero */}
        <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-panel-2">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${current.progress}%`, backgroundColor: current.color }}
          />
        </div>
      </div>

      {message ? (
        <div className="rounded-xl border border-focus/30 bg-focus/10 px-4 py-2.5 text-xs font-semibold text-focus">
          {message}
        </div>
      ) : null}

      {/* Layout Split: Settings on left, Tasks & Blocks on right */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Project Details Form */}
        <div className="lg:col-span-2">
          <Card>
            <h2 className="text-base font-bold text-ink mb-4">Configurações do Projeto</h2>
            <form className="grid gap-3.5 md:grid-cols-2" onSubmit={form.handleSubmit(save)}>
              <Field label="Nome">
                <input className={controlClass} {...form.register("name")} />
              </Field>

              <Field label="Cor de Destaque">
                <input type="color" {...form.register("color")} />
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

              <Field label="Status">
                <select className={controlClass} {...form.register("status")}>
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {PROJECT_STATUS_LABEL[status]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Categoria">
                <select className={controlClass} {...form.register("category")}>
                  {PROJECT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {CATEGORY_LABEL[category]}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Progresso (%)">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={controlClass}
                  {...form.register("progress", { valueAsNumber: true })}
                />
              </Field>

              <Field label="Prazo Final">
                <input
                  type="date"
                  className={controlClass}
                  {...form.register("deadline", { setValueAs: (value) => value || null })}
                />
              </Field>

              <div className="md:col-span-2">
                <Field label="Objetivo Principal">
                  <textarea className={controlClass} rows={2} {...form.register("description")} />
                </Field>
              </div>

              <div className="md:col-span-2">
                <Field label="Notas e Observações">
                  <textarea className={controlClass} rows={4} {...form.register("notes")} />
                </Field>
              </div>

              <div className="md:col-span-2 pt-2">
                <Button type="submit">Salvar Alterações</Button>
              </div>
            </form>
          </Card>
        </div>

        {/* Tasks and Blocks Column */}
        <div className="space-y-6">
          {/* Associated Tasks */}
          <Card>
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-ink">Tarefas</h2>
                <span className="text-[11px] text-muted">{current.tasks.length} vinculadas</span>
              </div>
              <Button
                variant="ghost"
                className="h-8 px-2.5 text-xs"
                onClick={() => setTaskDraft({ mode: "create", status: "BACKLOG", projectId: id })}
              >
                <Plus className="h-3.5 w-3.5" />
                Nova
              </Button>
            </div>

            <ul className="grid gap-2">
              {current.tasks.map((task) => (
                <li key={task.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2.5 rounded-xl border border-line bg-panel-2/50 px-3 py-2 text-left text-xs transition hover:border-line/80 hover:bg-panel-2 cursor-pointer"
                    type="button"
                    onClick={() => setTaskDraft({ mode: "edit", task })}
                  >
                    <span className="truncate font-semibold text-ink">{task.title}</span>
                    <PriorityBadge priority={task.priority} />
                  </button>
                </li>
              ))}
              {current.tasks.length === 0 ? (
                <li className="py-4 text-center text-xs text-muted">Nenhuma tarefa cadastrada.</li>
              ) : null}
            </ul>
          </Card>

          {/* Associated Blocks */}
          <Card>
            <div className="border-b border-line/60 pb-3 mb-3">
              <h2 className="text-sm font-bold text-ink">Blocos na Agenda</h2>
              <span className="text-[11px] text-muted">{current.blocks.length} blocos registrados</span>
            </div>

            <ul className="grid gap-2">
              {current.blocks.map((block) => (
                <li
                  key={block.id}
                  className="rounded-xl border border-line bg-panel-2/50 px-3 py-2 text-xs font-medium text-ink"
                >
                  {block.title}
                </li>
              ))}
              {current.blocks.length === 0 ? (
                <li className="py-4 text-center text-xs text-muted">Sem blocos recentes.</li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>

      <TaskDialog
        draft={taskDraft}
        projects={projects.data?.projects ?? []}
        onClose={() => setTaskDraft(null)}
        onSaved={async () => queryClient.invalidateQueries()}
      />

      <Dialog
        open={activeChoices.length > 0}
        title="Limite de 4 projetos ativos atingido"
        subtitle="Escolha qual projeto deseja estacionar para liberar espaço"
        onClose={() => setActiveChoices([])}
      >
        <div className="mt-2 grid gap-2">
          {activeChoices.map((choice) => (
            <Button
              key={choice.id}
              variant="ghost"
              className="justify-start text-xs font-semibold"
              onClick={() => activate(choice.id)}
            >
              Estacionar {choice.name}
            </Button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
