import { Router } from "express";
import { focusEndSchema, focusStartSchema } from "rotina-bonette-shared";
import { AppError, notFound } from "../lib/errors.js";
import { asyncHandler, parse } from "../lib/http.js";
import { presentTask } from "../lib/present.js";
import { prisma } from "../lib/prisma.js";
import { getSettings } from "./settings.js";
import { moveTaskTx } from "./tasks.js";

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export const focusRouter = Router();

focusRouter.get(
  "/current",
  asyncHandler(async (_req, res) => {
    const session = await prisma.focusSession.findFirst({
      where: { status: "RUNNING" },
      include: { task: { include: { project: { select: { id: true, name: true, color: true, icon: true, status: true, priority: true } } } } },
      orderBy: { startedAt: "desc" },
    });
    res.json({ session });
  }),
);

focusRouter.get(
  "/history",
  asyncHandler(async (_req, res) => {
    const sessions = await prisma.focusSession.findMany({
      include: { task: { select: { id: true, title: true } } },
      orderBy: { startedAt: "desc" },
      take: 30,
    });
    res.json({ sessions });
  }),
);

focusRouter.post(
  "/start",
  asyncHandler(async (req, res) => {
    const input = parse(focusStartSchema, req.body);
    const settings = await getSettings();
    const result = await prisma.$transaction(async (tx) => {
      const running = await tx.focusSession.findFirst({ where: { status: "RUNNING" } });
      if (running?.taskId === input.taskId) return { session: running, replaced: null, taskId: input.taskId };
      if (running) {
        throw new AppError(409, "CONFLICT", "Já existe uma sessão de foco aberta.");
      }
      const moved = await moveTaskTx(tx, input.taskId, {
        status: "DOING",
        confirmReplace: input.confirmReplace,
      });
      const session = await tx.focusSession.create({
        data: {
          taskId: input.taskId,
          plannedMinutes: input.plannedMinutes ?? settings.defaultFocusMinutes,
          status: "RUNNING",
        },
      });
      return { session, replaced: moved.replaced, task: moved.task };
    });
    const task = "task" in result && result.task ? await presentTask(result.task) : null;
    res.status(201).json({ session: result.session, task, replaced: result.replaced });
  }),
);

focusRouter.post(
  "/:id/finish",
  asyncHandler(async (req, res) => {
    const input = parse(focusEndSchema, req.body ?? {});
    const existing = await prisma.focusSession.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Sessão não encontrada.");
    if (existing.status !== "RUNNING") throw new AppError(409, "CONFLICT", "Essa sessão já foi encerrada.");
    const endedAt = new Date();
    const session = await prisma.focusSession.update({
      where: { id: existing.id },
      data: {
        status: "COMPLETED",
        endedAt,
        actualMinutes: input.actualMinutes ?? minutesBetween(existing.startedAt, endedAt),
        notes: input.notes ?? existing.notes,
      },
    });
    res.json({ session });
  }),
);

focusRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const input = parse(focusEndSchema, req.body ?? {});
    const existing = await prisma.focusSession.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Sessão não encontrada.");
    if (existing.status !== "RUNNING") throw new AppError(409, "CONFLICT", "Essa sessão já foi encerrada.");
    const endedAt = new Date();
    const session = await prisma.focusSession.update({
      where: { id: existing.id },
      data: {
        status: "CANCELLED",
        endedAt,
        actualMinutes: input.actualMinutes ?? minutesBetween(existing.startedAt, endedAt),
        notes: input.notes ?? existing.notes,
      },
    });
    res.json({ session });
  }),
);
