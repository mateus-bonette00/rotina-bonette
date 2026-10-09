import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Pause,
  Play,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui";
import { api } from "../../lib/api";
import { cx } from "../../lib/format";
import type { FocusSession, Task } from "../../types";

function formatClock(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "+" : "";
  const absolute = Math.abs(totalSeconds);
  const minutes = Math.floor(absolute / 60).toString().padStart(2, "0");
  const seconds = Math.floor(absolute % 60).toString().padStart(2, "0");
  return `${sign}${minutes}:${seconds}`;
}

export function FocusPage() {
  const queryClient = useQueryClient();
  const current = useQuery({
    queryKey: ["focus-current"],
    queryFn: () => api<{ session: (FocusSession & { task: Task }) | null }>("/focus/current"),
  });
  const tasks = useQuery({ queryKey: ["tasks", "focus"], queryFn: () => api<{ tasks: Task[] }>("/tasks") });
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [note, setNote] = useState("");
  const session = current.data?.session ?? null;

  useEffect(() => {
    if (!session || paused) return;
    const started = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [session, paused]);

  const planned = (session?.plannedMinutes ?? 25) * 60;
  const remaining = planned - elapsed;

  async function finish(completeTask: boolean) {
    if (!session) return;
    await api(`/focus/${session.id}/finish`, {
      method: "POST",
      body: JSON.stringify({ notes: note || null, actualMinutes: Math.max(1, Math.round(elapsed / 60)) }),
    });
    if (completeTask) await api(`/tasks/${session.taskId}/complete`, { method: "POST", body: "{}" });
    await queryClient.invalidateQueries();
  }

  return (
    <main className="relative grid min-h-[100dvh] place-items-center px-4 py-8 bg-bg overflow-hidden select-none">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-focus/10 blur-[130px]"
      />

      {/* Floating back button */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel/80 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-muted hover:text-ink transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao calendário
        </Link>
      </div>

      <section className="relative z-10 w-full max-w-xl text-center">
        {session ? (
          <div className="flex flex-col items-center">
            {/* Project / Category badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-focus/25 bg-focus/10 px-3 py-1 text-xs font-semibold text-focus">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-focus opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-focus"></span>
              </span>
              <span>{session.task.project?.name ?? "Foco Profundo"}</span>
            </div>

            {/* Task Title & Next Action */}
            <h1
              className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight text-ink leading-tight"
              data-testid="focus-task"
            >
              {session.task.title}
            </h1>
            <p className="mt-2 text-sm text-muted max-w-md">
              {session.task.nextAction ?? "Concentre-se neste próximo passo até concluir."}
            </p>

            {/* Huge Timer Display with breathing aura */}
            <div className="relative my-8 grid place-items-center">
              <div
                className={cx(
                  "pointer-events-none absolute h-64 w-64 rounded-full transition-opacity duration-1000 blur-2xl",
                  paused ? "opacity-0" : "opacity-30 bg-focus",
                )}
              />
              <p
                className="font-mono text-7xl md:text-8xl font-bold tracking-tight text-ink tabular-nums"
                data-testid="focus-timer"
              >
                {formatClock(remaining)}
              </p>
            </div>

            {remaining <= 0 ? (
              <p className="text-xs font-semibold text-warn mb-4 animate-pulse">
                O tempo planejado acabou. Você pode continuar no fluxo ou concluir agora.
              </p>
            ) : null}

            {/* Quick in-focus note */}
            <div className="w-full max-w-md mb-6">
              <textarea
                className="w-full rounded-2xl border border-line bg-panel p-3.5 text-xs text-ink placeholder:text-muted/60 outline-none focus:border-focus focus:ring-2 focus:ring-focus/15 transition resize-none shadow-sm"
                rows={2}
                placeholder="Anotações rápidas ou aprendizados desta sessão..."
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setPaused((value) => !value)}
                className="h-10 px-4 text-xs font-semibold"
              >
                {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                {paused ? "Continuar" : "Pausar"}
              </Button>

              <Button onClick={() => finish(true)} className="h-10 px-5 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                Concluir Tarefa
              </Button>

              <Button
                variant="danger"
                onClick={async () => {
                  await api(`/focus/${session.id}/cancel`, {
                    method: "POST",
                    body: JSON.stringify({ notes: note || null }),
                  });
                  await queryClient.invalidateQueries();
                }}
                className="h-10 px-4 text-xs font-semibold"
              >
                <X className="h-3.5 w-3.5" />
                Abandonar
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 text-left">
            <div className="text-center mb-4">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-focus/15 text-focus mb-3">
                <Timer className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">Iniciar Sessão de Foco</h1>
              <p className="mt-1 text-xs text-muted">
                Escolha a tarefa prioritária de hoje para entrar em modo de execução sem distrações.
              </p>
            </div>

            {(tasks.data?.tasks ?? [])
              .filter((task) => task.status === "DOING" || task.status === "TODAY")
              .map((task) => (
                <button
                  key={task.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-panel p-4 text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-focus hover:shadow-md cursor-pointer"
                  onClick={() =>
                    api("/focus/start", {
                      method: "POST",
                      body: JSON.stringify({ taskId: task.id, confirmReplace: true }),
                    }).then(() => queryClient.invalidateQueries())
                  }
                >
                  <div>
                    <h3 className="text-sm font-bold text-ink">{task.title}</h3>
                    <p className="mt-0.5 text-xs text-muted">
                      {task.project?.name ?? "Sem projeto"}{task.nextAction ? ` · ${task.nextAction}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-focus/10 px-3 py-1 text-xs font-bold text-focus">
                    Iniciar
                  </span>
                </button>
              ))}

            {(tasks.data?.tasks ?? []).filter((task) => task.status === "DOING" || task.status === "TODAY")
              .length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center text-xs text-muted">
                Nenhuma tarefa em Fazendo ou Hoje. Selecione tarefas no Kanban primeiro.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
