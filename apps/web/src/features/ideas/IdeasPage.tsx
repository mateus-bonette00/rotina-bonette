import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FolderPlus,
  Lightbulb,
  ListPlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ideaWriteSchema } from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Dialog, Field, controlClass } from "../../components/ui";
import { api } from "../../lib/api";
import { cx } from "../../lib/format";
import type { Idea, Project } from "../../types";

type FormValues = z.infer<typeof ideaWriteSchema>;

export function IdeasPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Idea | "new" | null>(null);
  const ideas = useQuery({ queryKey: ["ideas"], queryFn: () => api<{ ideas: Idea[] }>("/ideas") });
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => api<{ projects: Project[] }>("/projects") });
  const form = useForm<FormValues>({ resolver: zodResolver(ideaWriteSchema) });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["ideas"] });
    await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }

  const activeIdeas = ideas.data?.ideas.filter((idea) => idea.status !== "DISCARDED") ?? [];

  return (
    <div className="grid gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-focus/15 text-focus">
              <Lightbulb className="h-4 w-4" />
            </span>
            <h1 className="page-title">Inbox de Ideias</h1>
          </div>
          <p className="mt-1 text-xs text-muted">
            Lugar seguro para descarregar pensamentos. Uma ideia só consome energia de trabalho quando você decidir converter.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing("new");
            form.reset({ title: "", description: "", category: "" });
          }}
          className="h-9.5 px-4 text-xs"
        >
          <Plus className="h-4 w-4" />
          Nova ideia
        </Button>
      </header>

      {/* Ideas Grid */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {activeIdeas.map((idea) => (
          <div
            key={idea.id}
            className="flex flex-col justify-between rounded-2xl border border-line bg-panel p-5 shadow-sm transition-all duration-150 hover:border-line/80 hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span
                  className={cx(
                    "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    idea.status === "REVIEWED"
                      ? "bg-ok/10 text-ok border border-ok/20"
                      : "bg-panel-2 text-muted border border-line",
                  )}
                >
                  {idea.status === "REVIEWED" ? "Revisada" : "Na Caixa"}
                </span>
                {idea.category ? (
                  <span className="text-[11px] font-medium text-muted">{idea.category}</span>
                ) : null}
              </div>

              <h2 className="text-sm font-bold text-ink leading-snug">{idea.title}</h2>
              <p className="mt-2 text-xs text-muted line-clamp-3">
                {idea.description || "Sem notas adicionais."}
              </p>
            </div>

            {idea.status !== "CONVERTED" ? (
              <div className="mt-5 border-t border-line/60 pt-3 flex flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  className="h-8 px-2.5 text-xs"
                  onClick={() =>
                    api(`/ideas/${idea.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: "REVIEWED" }),
                    }).then(refresh)
                  }
                  title="Marcar como revisada"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Manter
                </Button>

                <Button
                  variant="ghost"
                  className="h-8 px-2.5 text-xs"
                  onClick={() => {
                    setEditing(idea);
                    form.reset({
                      title: idea.title,
                      description: idea.description ?? "",
                      category: idea.category,
                    });
                  }}
                  title="Editar texto"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <Button
                  variant="ghost"
                  className="h-8 px-2.5 text-xs text-focus hover:bg-focus/10"
                  onClick={() =>
                    api(`/ideas/${idea.id}/convert-to-task`, {
                      method: "POST",
                      body: JSON.stringify({ projectId: projects.data?.projects[0]?.id ?? null }),
                    }).then(refresh)
                  }
                  title="Transformar em tarefa do quadro"
                >
                  <ListPlus className="h-3.5 w-3.5" />
                  Virar tarefa
                </Button>

                <Button
                  variant="ghost"
                  className="h-8 px-2.5 text-xs"
                  onClick={() =>
                    api(`/ideas/${idea.id}/convert-to-project`, { method: "POST", body: "{}" }).then(refresh)
                  }
                  title="Iniciar como novo projeto"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Virar projeto
                </Button>

                <Button
                  variant="danger"
                  className="h-8 w-8 p-0 ml-auto"
                  onClick={() =>
                    api(`/ideas/${idea.id}/discard`, { method: "POST", body: "{}" }).then(refresh)
                  }
                  title="Descartar ideia"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {activeIdeas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center">
          <Lightbulb className="mx-auto h-8 w-8 text-muted/50 mb-2" />
          <p className="text-sm font-semibold text-ink">Nenhuma ideia na inbox</p>
          <p className="text-xs text-muted mt-1">Use o botão acima para registrar pensamentos.</p>
        </div>
      ) : null}

      {/* Create / Edit Idea Modal */}
      <Dialog
        open={Boolean(editing)}
        title={editing === "new" ? "Nova Ideia" : "Editar Ideia"}
        subtitle="Ideias ficam guardadas até você decidir transformá-las em ação"
        onClose={() => setEditing(null)}
      >
        <form
          className="grid gap-3.5"
          onSubmit={form.handleSubmit(async (values) => {
            if (!editing) return;
            if (editing === "new") {
              await api("/ideas", { method: "POST", body: JSON.stringify(values) });
            } else {
              await api(`/ideas/${editing.id}`, { method: "PATCH", body: JSON.stringify(values) });
            }
            setEditing(null);
            await refresh();
          })}
        >
          <Field label="Título">
            <input
              className={controlClass}
              placeholder="Ex: Explorar novo layout para checkout..."
              autoFocus
              {...form.register("title")}
            />
          </Field>

          <Field label="Categoria (Opcional)">
            <input
              className={controlClass}
              placeholder="Ex: Produto, Estudo, Pessoal..."
              {...form.register("category")}
            />
          </Field>

          <Field label="Notas e Detalhes">
            <textarea
              className={controlClass}
              rows={3}
              placeholder="Descreva a intuição ou links de referência..."
              {...form.register("description")}
            />
          </Field>

          <div className="mt-2 flex items-center gap-2 border-t border-line/60 pt-3">
            <Button type="submit">Salvar Ideia</Button>
            <Button type="button" variant="quiet" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
