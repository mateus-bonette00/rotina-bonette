import { Router } from "express";
import { calendarWriteSchema, expandRoutine, routineExceptionWriteSchema, routinePatchSchema, routineWriteSchema } from "rotina-bonette-shared";
import type { RoutineSlot } from "rotina-bonette-shared";
import { AppError, notFound } from "../lib/errors.js";
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
      include: {
        project: { select: { id: true, name: true, color: true } },
        exceptions: { orderBy: { startDate: "asc" } },
        overrides: { include: { project: { select: { id: true, name: true, color: true } } } },
      },
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
        priority: input.priority ?? "P3",
        notes: input.notes ?? null,
        intervalWeeks: input.intervalWeeks ?? 1,
        anchorDate: input.anchorDate ?? null,
        dayTimes: input.dayTimes ?? {},
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
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.intervalWeeks !== undefined ? { intervalWeeks: input.intervalWeeks } : {}),
        ...(input.anchorDate !== undefined ? { anchorDate: input.anchorDate } : {}),
        ...(input.dayTimes !== undefined ? { dayTimes: input.dayTimes } : {}),
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

routinesRouter.post(
  "/:id/exceptions",
  asyncHandler(async (req, res) => {
    const input = parse(routineExceptionWriteSchema, req.body);
    const existing = await prisma.routine.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Rotina não encontrada.");
    const exception = await prisma.routineException.create({ data: { routineId: existing.id, ...input } });
    res.status(201).json({ exception });
  }),
);

routinesRouter.delete(
  "/:id/exceptions/:exceptionId",
  asyncHandler(async (req, res) => {
    const { count } = await prisma.routineException.deleteMany({
      where: { id: req.params.exceptionId, routineId: req.params.id },
    });
    if (!count) throw notFound("Pausa não encontrada.");
    res.status(204).send();
  }),
);

async function findOccurrence(routineId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, "INVALID_DATE", "Data inválida.");
  const routine = await prisma.routine.findUnique({ where: { id: routineId } });
  if (!routine) throw notFound("Rotina não encontrada.");
  const matches = expandRoutine(
    { ...routine, dayTimes: routine.dayTimes as Record<string, RoutineSlot> },
    [], date, date,
  );
  if (matches.length !== 1 || matches[0].date !== date) throw notFound("Ocorrência não encontrada nesta data.");
  return routine;
}

routinesRouter.put(
  "/:id/occurrences/:date",
  asyncHandler(async (req, res) => {
    const input = parse(calendarWriteSchema, req.body);
    const routine = await findOccurrence(req.params.id, req.params.date);
    const data = {
      cancelled: false,
      title: input.title,
      type: input.type,
      priority: input.priority ?? routine.priority,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      projectId: input.projectId === undefined ? routine.projectId : input.projectId,
      taskId: input.taskId ?? null,
      notes: input.notes === undefined ? routine.notes : input.notes,
    } as const;
    const override = await prisma.routineOccurrenceOverride.upsert({
      where: { routineId_date: { routineId: req.params.id, date: req.params.date } },
      create: { routineId: req.params.id, date: req.params.date, ...data },
      update: data,
    });
    res.json({ override });
  }),
);

routinesRouter.delete(
  "/:id/occurrences/:date",
  asyncHandler(async (req, res) => {
    await findOccurrence(req.params.id, req.params.date);
    await prisma.routineOccurrenceOverride.upsert({
      where: { routineId_date: { routineId: req.params.id, date: req.params.date } },
      create: { routineId: req.params.id, date: req.params.date, cancelled: true },
      update: { cancelled: true },
    });
    res.status(204).send();
  }),
);

routinesRouter.delete(
  "/:id/occurrences/:date/override",
  asyncHandler(async (req, res) => {
    const { count } = await prisma.routineOccurrenceOverride.deleteMany({
      where: { routineId: req.params.id, date: req.params.date },
    });
    if (!count) throw notFound("Alteração não encontrada.");
    res.status(204).send();
  }),
);
