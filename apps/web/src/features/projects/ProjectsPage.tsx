import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FolderKanban,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import {
  CATEGORY_LABEL,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  PROJECT_STATUS_LABEL,
  projectWriteSchema,
  type ProjectCategory,
  type ProjectStatus,
} from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Dialog, Field, PriorityBadge, ProjectIcon, controlClass } from "../../components/ui";
import { api } from "../../lib/api";
import type { Project } from "../../types";

type FormValues = z.infer<typeof projectWriteSchema>;

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<{ projects: Project[] }>("/projects") });
  const form = useForm<FormValues>({
    resolver: zodResolver(projectWriteSchema),
    defaultValues: {
      name: "",
      description: "",
      color: "#2563eb",
      icon: "folder",
      status: "PARKED",
      priority: "P3",
      category: "PERSONAL",
      progress: 0,
    },
  });

  async function create(values: FormValues) {
    await api("/projects", { method: "POST", body: JSON.stringify(values) });
    setOpen(false);
    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const activeCount = projects.data?.projects.filter((p) => p.status === "ACTIVE").length ?? 0;

  return (
    <div className="grid gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-focus/15 text-focus">
              <FolderKanban className="h-4 w-4" />
            </span>
            <h1 className="page-title">Projetos</h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            Ativos no foco: <strong className="text-ink tabular-nums">{activeCount}</strong>/4. Mantenha poucos projetos ativos para preservar o ritmo.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="h-9.5 px-4 text-xs">
          <Plus className="h-4 w-4" />
          Novo projeto
        </Button>
      </header>

      {/* Sections by Status */}
      <div className="grid gap-6">
        {PROJECT_STATUSES.map((status) => {
          const items = projects.data?.projects.filter((project) => project.status === status) ?? [];
          return (
            <section key={status} className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted flex items-center gap-2">
                  <span>{PROJECT_STATUS_LABEL[status]}</span>
                  <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-semibold text-muted tabular-nums">
                    {items.length}
                  </span>
                </h2>
              </div>

              {items.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line p-6 text-center text-xs text-muted">
                  Nenhum projeto em {PROJECT_STATUS_LABEL[status].toLowerCase()}.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((project) => (
                    <Link
                      key={project.id}
                      to={`/projetos/${project.id}`}
                      className="group relative flex flex-col rounded-2xl border border-line bg-panel p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-line/80 hover:shadow-md cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3">
                          <span
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white shadow-xs"
                            style={{ backgroundColor: project.color }}
                          >
                            <ProjectIcon name={project.icon} className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-ink group-hover:text-focus transition">
                              {project.name}
                            </h3>
                            <span className="text-[11px] font-medium text-muted">
                              {CATEGORY_LABEL[project.category as ProjectCategory]}
                            </span>
                          </div>
                        </div>
                        <PriorityBadge priority={project.priority} />
                      </div>

                      <p className="mt-3 text-xs text-muted line-clamp-2 min-h-[2rem]">
                        {project.description || "Sem descrição definida."}
                      </p>

                      {/* Progress Bar & Footer */}
                      <div className="mt-4 border-t border-line/60 pt-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[11px] font-medium text-muted">Progresso</span>
                          <span className="font-mono text-[11px] font-bold text-ink tabular-nums">
                            {project.progress}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${project.progress}%`, backgroundColor: project.color }}
                          />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* New Project Modal */}
      <Dialog
        open={open}
        title="Novo Projeto"
        subtitle="Crie um novo projeto com limites claros de foco"
        onClose={() => setOpen(false)}
      >
        <form className="grid gap-3.5" onSubmit={form.handleSubmit(create)}>
          <Field label="Nome do Projeto">
            <input className={controlClass} placeholder="Ex: Redesign da Landing Page" autoFocus {...form.register("name")} />
          </Field>

          <Field label="Objetivo / Descrição">
            <textarea className={controlClass} rows={2} placeholder="Meta e escopo do projeto..." {...form.register("description")} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cor de Identificação">
              <input type="color" {...form.register("color")} />
            </Field>

            <Field label="Status Inicial">
              <select className={controlClass} {...form.register("status")}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {PROJECT_STATUS_LABEL[status as ProjectStatus]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Categoria">
              <select className={controlClass} {...form.register("category")}>
                {PROJECT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category as ProjectCategory]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Prioridade">
              <select className={controlClass} {...form.register("priority")}>
                {["P1", "P2", "P3", "P4"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="mt-2 flex items-center gap-2 border-t border-line/60 pt-3">
            <Button type="submit">Criar Projeto</Button>
            <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
