import { Router } from "express";
import { calendarPatchSchema, calendarWriteSchema } from "rotina-bonette-shared";
import { AppError, notFound } from "../lib/errors.js";
import { asDate, asyncHandler, parse } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

export const calendarRouter = Router();

calendarRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === "string" ? asDate(req.query.from) : undefined;
    const to = typeof req.query.to === "string" ? asDate(req.query.to) : undefined;
    const blocks = await prisma.calendarBlock.findMany({
      where: {
        ...(from ? { endAt: { gt: from } } : {}),
        ...(to ? { startAt: { lt: to } } : {}),
      },
      include: {
        project: { select: { id: true, name: true, color: true } },
        task: { select: { id: true, title: true } },
      },
      orderBy: { startAt: "asc" },
    });
    res.json({ blocks });
  }),
);

calendarRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(calendarWriteSchema, req.body);
    const block = await prisma.calendarBlock.create({
      data: {
        title: input.title,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        type: input.type,
        startAt: asDate(input.startAt)!,
        endAt: asDate(input.endAt)!,
        notes: input.notes ?? null,
      },
    });
    res.status(201).json({ block });
  }),
);

calendarRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(calendarPatchSchema, req.body);
    const existing = await prisma.calendarBlock.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Bloco não encontrado.");
    const startAt = input.startAt ? asDate(input.startAt)! : existing.startAt;
    const endAt = input.endAt ? asDate(input.endAt)! : existing.endAt;
    if (endAt.getTime() <= startAt.getTime()) {
      throw new AppError(400, "VALIDATION_ERROR", "O fim precisa ser depois do início.");
    }
    const block = await prisma.calendarBlock.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        startAt,
        endAt,
      },
    });
    res.json({ block });
  }),
);

calendarRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.calendarBlock.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Bloco não encontrado.");
    await prisma.calendarBlock.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);
