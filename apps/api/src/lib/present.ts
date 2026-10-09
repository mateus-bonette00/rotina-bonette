import type { Prisma, ProjectStatus } from "@prisma/client";
import { scoreTask, type ScoreReason } from "rotina-bonette-shared";
import { prisma } from "./prisma.js";

export const taskInclude = {
  project: {
    select: {
      id: true,
      name: true,
      color: true,
      icon: true,
      status: true,
      priority: true,
    },
  },
} satisfies Prisma.TaskInclude;

export type TaskWithProject = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

type BlockedRow = { id: string; projectId: string | null };

function decorate(task: TaskWithProject, blocked: BlockedRow[]): TaskWithProject & { score: number; reasons: ScoreReason[] } {
  const siblings = blocked.filter((row) => row.projectId === task.projectId && row.id !== task.id);
  // ponytail: sem dependência explícita, "desbloqueia" = existe outra tarefa bloqueada no mesmo projeto ativo.
  const unblocksWork = Boolean(task.projectId) && task.project?.status === "ACTIVE" && !task.blocked && siblings.length > 0;
  const scored = scoreTask({
    priority: task.priority,
    dueDate: task.dueDate,
    externalCommitment: task.externalCommitment,
    estimatedMinutes: task.estimatedMinutes,
    blocked: task.blocked,
    projectStatus: (task.project?.status as ProjectStatus | undefined) ?? null,
    unblocksWork,
  });
  return { ...task, ...scored };
}

export async function presentTasks(tasks: TaskWithProject[]) {
  const projectIds = [...new Set(tasks.map((task) => task.projectId).filter((id): id is string => Boolean(id)))];
  const blocked = projectIds.length
    ? await prisma.task.findMany({
        where: { blocked: true, projectId: { in: projectIds } },
        select: { id: true, projectId: true },
      })
    : [];
  return tasks.map((task) => decorate(task, blocked));
}

export async function presentTask(task: TaskWithProject) {
  const [presented] = await presentTasks([task]);
  return presented;
}
