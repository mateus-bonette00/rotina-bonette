import type { Priority, ProjectStatus } from "./domain.js";

export type ScoreReason = {
  code: string;
  label: string;
  points: number;
};

const PRIORITY_POINTS: Record<Priority, number> = {
  P1: 40,
  P2: 30,
  P3: 20,
  P4: 10,
};

export type ScoreInput = {
  priority: Priority;
  dueDate: Date | string | null;
  externalCommitment: boolean;
  estimatedMinutes: number | null;
  blocked: boolean;
  projectStatus: ProjectStatus | null;
  unblocksWork: boolean;
  now?: Date;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dueReason(dueDate: Date | string | null, now: Date): ScoreReason | null {
  if (!dueDate) return null;
  const due = startOfDay(new Date(dueDate));
  const today = startOfDay(now);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return { code: "overdue", label: "Prazo atrasado", points: 35 };
  if (diffDays === 0) return { code: "due-today", label: "Vence hoje", points: 30 };
  if (diffDays <= 3) return { code: "due-3", label: "Vence em até 3 dias", points: 20 };
  if (diffDays <= 7) return { code: "due-7", label: "Vence em até 7 dias", points: 10 };
  return null;
}

export function scoreTask(input: ScoreInput): { score: number; reasons: ScoreReason[] } {
  const now = input.now ?? new Date();
  const reasons: ScoreReason[] = [
    {
      code: `priority-${input.priority}`,
      label: `Prioridade ${input.priority}`,
      points: PRIORITY_POINTS[input.priority],
    },
  ];

  const due = dueReason(input.dueDate, now);
  if (due) reasons.push(due);
  if (input.externalCommitment) {
    reasons.push({ code: "external", label: "Obrigação externa", points: 15 });
  }
  if (input.unblocksWork) {
    reasons.push({ code: "unblocks", label: "Desbloqueia outra atividade", points: 10 });
  }
  if (input.estimatedMinutes != null && input.estimatedMinutes <= 30) {
    reasons.push({ code: "quick-win", label: "Quick win (até 30 min)", points: 5 });
  }
  if (input.projectStatus === "ACTIVE") {
    reasons.push({ code: "active-project", label: "Projeto ativo", points: 0 });
  }
  if (input.blocked) reasons.push({ code: "blocked", label: "Tarefa bloqueada", points: -100 });
  if (input.projectStatus === "PARKED") {
    reasons.push({ code: "parked", label: "Projeto estacionado", points: -100 });
  }
  if (input.projectStatus === "ARCHIVED") {
    reasons.push({ code: "archived", label: "Projeto arquivado", points: -100 });
  }

  const score = reasons.reduce((sum, reason) => sum + reason.points, 0);
  return { score, reasons };
}
