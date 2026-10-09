import { Router } from "express";
import { routinePatchSchema, routineWriteSchema } from "rotina-bonette-shared";
import { notFound } from "../lib/errors.js";
import { asyncHandler, parse } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

function uniqueDays(days: number[] | undefined): number[] | undefined {
  if (!days) return undefined;
  return [...new Set(days)].sort((a, b) => a - b);
}

export const routinesRouter = Router();

routinesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const routines = await prisma.routine.findMany({
      include: { project: { select: { id: true, name: true, color: true } } },
      orderBy: { name: "asc" },
    });
    res.json({ routines });
  }),
);

routinesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(routineWriteSchema, req.body);
    const routine = await prisma.routine.create({
      data: {
        name: input.name,
        projectId: input.projectId ?? null,
        enabled: input.enabled ?? true,
        daysOfWeek: uniqueDays(input.daysOfWeek) ?? [],
        startTime: input.startTime ?? null,
        durationMinutes: input.durationMinutes,
        type: input.type,
        notes: input.notes ?? null,
      },
    });
    res.status(201).json({ routine });
  }),
);

routinesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(routinePatchSchema, req.body);
    const existing = await prisma.routine.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Rotina não encontrada.");
    const routine = await prisma.routine.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.daysOfWeek !== undefined ? { daysOfWeek: uniqueDays(input.daysOfWeek) } : {}),
        ...(input.startTime !== undefined ? { startTime: input.startTime } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });
    res.json({ routine });
  }),
);

routinesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.routine.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Rotina não encontrada.");
    await prisma.routine.delete({ where: { id: existing.id } });
    res.status(204).send();
  }),
);
