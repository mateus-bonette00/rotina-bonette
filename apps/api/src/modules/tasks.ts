import { Router } from "express";
import type { Prisma, TaskStatus } from "@prisma/client";
import { moveTaskSchema, reorderTasksSchema, taskPatchSchema, taskWriteSchema } from "rotina-bonette-shared";
import { AppError, notFound } from "../lib/errors.js";
import { asDate, asyncHandler, parse } from "../lib/http.js";
import { presentTask, presentTasks, taskInclude, type TaskWithProject } from "../lib/present.js";
import { prisma } from "../lib/prisma.js";

type Tx = Prisma.TransactionClient;

async function nextDailyRank(tx: Tx, excludeId?: string): Promise<number | null> {
  const used = await tx.task.findMany({
    where: {
      status: "TODAY",
      dailyRank: { not: null },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { dailyRank: true },
  });
  const taken = new Set(used.map((row) => row.dailyRank));
  for (const rank of [1, 2, 3]) {
    if (!taken.has(rank)) return rank;
  }
  return null;
}

async function closeRunningFocus(tx: Tx, taskId: string, status: "COMPLETED" | "CANCELLED") {
  const running = await tx.focusSession.findMany({ where: { taskId, status: "RUNNING" } });
  const now = new Date();
  for (const session of running) {
    const actual = Math.max(1, Math.round((now.getTime() - session.startedAt.getTime()) / 60000));
    await tx.focusSession.update({
      where: { id: session.id },
      data: { status, endedAt: now, actualMinutes: actual },
    });
  }
}

export async function moveTaskTx(
  tx: Tx,
  id: string,
  input: { status: TaskStatus; sortOrder?: number; confirmReplace?: boolean },
): Promise<{ task: TaskWithProject; replaced: { id: string; title: string; status: TaskStatus } | null }> {
  const task = await tx.task.findUnique({ where: { id } });
  if (!task) throw notFound("Tarefa não encontrada.");

  const replaced: { id: string; title: string; status: TaskStatus } | null = null;

  let dailyRank = task.dailyRank;
  if (input.status === "TODAY" && task.status !== "TODAY") {
    dailyRank = await nextDailyRank(tx, task.id);
  } else if (input.status !== "TODAY") {
    dailyRank = null;
  }

  let sortOrder = input.sortOrder;
  if (sortOrder === undefined) {
    const aggregate = await tx.task.aggregate({
      where: { status: input.status, NOT: { id: task.id } },
      _max: { sortOrder: true },
    });
    sortOrder = (aggregate._max.sortOrder ?? 0) + 1;
  }

  const updated = await tx.task.update({
    where: { id },
    data: {
      status: input.status,
      sortOrder,
      dailyRank,
      completedAt: input.status === "DONE" ? (task.completedAt ?? new Date()) : null,
    },
    include: taskInclude,
  });

  if (input.status === "DONE") {
    await closeRunningFocus(tx, id, "COMPLETED");
  }

  return { task: updated, replaced };
}

function taskData(input: {
  projectId?: string | null;
  title?: string;
  description?: string | null;
  priority?: "P1" | "P2" | "P3" | "P4";
  dailyRank?: number | null;
  estimatedMinutes?: number | null;
  energy?: "LOW" | "MEDIUM" | "HIGH";
  aversion?: "LOW" | "MEDIUM" | "HIGH";
  dueDate?: string | null;
  scheduledDate?: string | null;
  externalCommitment?: boolean;
  blocked?: boolean;
  blockReason?: string | null;
  nextAction?: string | null;
  sortOrder?: number;
}) {
  return {
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dailyRank !== undefined ? { dailyRank: input.dailyRank } : {}),
    ...(input.estimatedMinutes !== undefined ? { estimatedMinutes: input.estimatedMinutes } : {}),
    ...(input.energy !== undefined ? { energy: input.energy } : {}),
    ...(input.aversion !== undefined ? { aversion: input.aversion } : {}),
    ...(input.dueDate !== undefined ? { dueDate: asDate(input.dueDate) } : {}),
    ...(input.scheduledDate !== undefined ? { scheduledDate: asDate(input.scheduledDate) } : {}),
    ...(input.externalCommitment !== undefined ? { externalCommitment: input.externalCommitment } : {}),
    ...(input.blocked !== undefined ? { blocked: input.blocked } : {}),
    ...(input.blockReason !== undefined ? { blockReason: input.blockReason } : {}),
    ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
  };
}

export const tasksRouter = Router();

tasksRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = parse(
      taskWriteSchema.pick({ projectId: true, priority: true, status: true }).partial(),
      {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        projectId: typeof req.query.projectId === "string" ? req.query.projectId : undefined,
        priority: typeof req.query.priority === "string" ? req.query.priority : undefined,
      },
    );
    const settings = await prisma.appSettings.findUnique({ where: { id: "app" } });
    const days = settings?.showCompletedDays ?? 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const tasks = await prisma.task.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.projectId ? { projectId: query.projectId } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        OR: [{ status: { not: "DONE" } }, { completedAt: { gte: cutoff } }, { completedAt: null, status: "DONE" }],
      },
      include: taskInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    res.json({ tasks: await presentTasks(tasks) });
  }),
);

tasksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(taskWriteSchema, req.body);
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          projectId: input.projectId ?? null,
          priority: input.priority ?? "P3",
          estimatedMinutes: input.estimatedMinutes ?? null,
          energy: input.energy ?? "MEDIUM",
          aversion: input.aversion ?? "LOW",
          dueDate: asDate(input.dueDate) ?? null,
          scheduledDate: asDate(input.scheduledDate) ?? null,
          externalCommitment: input.externalCommitment ?? false,
          blocked: input.blocked ?? false,
          blockReason: input.blockReason ?? null,
          nextAction: input.nextAction ?? null,
          status: "INBOX",
        },
        include: taskInclude,
      });
      if (input.status && input.status !== "INBOX") {
        return moveTaskTx(tx, created.id, {
          status: input.status,
          confirmReplace: input.confirmReplace,
          sortOrder: input.sortOrder,
        });
      }
      return { task: created, replaced: null };
    });
    res.status(201).json({ task: await presentTask(result.task), replaced: result.replaced });
  }),
);

tasksRouter.post(
  "/reorder",
  asyncHandler(async (req, res) => {
    const input = parse(reorderTasksSchema, req.body);
    await prisma.$transaction(async (tx) => {
      const tasks = await tx.task.findMany({ where: { id: { in: input.orderedIds } } });
      if (tasks.length !== input.orderedIds.length) throw notFound("Tarefa não encontrada.");
      if (tasks.some((task) => task.status !== input.status)) {
        throw new AppError(409, "CONFLICT", "Reordene só tarefas que já estão nesta coluna.");
      }
      for (const [index, id] of input.orderedIds.entries()) {
        await tx.task.update({ where: { id }, data: { sortOrder: index } });
      }
    });
    res.json({ ok: true });
  }),
);

tasksRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
    if (!task) throw notFound("Tarefa não encontrada.");
    res.json({ task: await presentTask(task) });
  }),
);

tasksRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(taskPatchSchema, req.body);
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.task.findUnique({ where: { id: req.params.id } });
      if (!existing) throw notFound("Tarefa não encontrada.");
      let current = await tx.task.findUniqueOrThrow({ where: { id: existing.id }, include: taskInclude });
      let replaced = null as { id: string; title: string; status: TaskStatus } | null;
      if (input.status && input.status !== existing.status) {
        const moved = await moveTaskTx(tx, existing.id, {
          status: input.status,
          confirmReplace: input.confirmReplace,
          sortOrder: input.sortOrder,
        });
        current = moved.task;
        replaced = moved.replaced;
      }
      const data = taskData(input);
      delete (data as { sortOrder?: number }).sortOrder;
      if (input.status) {
        delete (data as { dailyRank?: number | null }).dailyRank;
      }
      const task = Object.keys(data).length
        ? await tx.task.update({ where: { id: existing.id }, data, include: taskInclude })
        : current;
      return { task, replaced };
    });
    res.json({ task: await presentTask(result.task), replaced: result.replaced });
  }),
);

tasksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Tarefa não encontrada.");
    await prisma.task.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);

tasksRouter.post(
  "/:id/move",
  asyncHandler(async (req, res) => {
    const input = parse(moveTaskSchema, req.body);
    const result = await prisma.$transaction((tx) => moveTaskTx(tx, req.params.id, input));
    res.json({ task: await presentTask(result.task), replaced: result.replaced });
  }),
);

tasksRouter.post(
  "/:id/complete",
  asyncHandler(async (req, res) => {
    const result = await prisma.$transaction((tx) => moveTaskTx(tx, req.params.id, { status: "DONE" }));
    res.json({ task: await presentTask(result.task) });
  }),
);

tasksRouter.post(
  "/:id/start",
  asyncHandler(async (req, res) => {
    const input = parse(moveTaskSchema.pick({ confirmReplace: true }), req.body ?? {});
    const result = await prisma.$transaction((tx) =>
      moveTaskTx(tx, req.params.id, { status: "DOING", confirmReplace: input.confirmReplace }),
    );
    res.json({ task: await presentTask(result.task), replaced: result.replaced });
  }),
);
