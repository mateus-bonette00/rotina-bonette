import { Router } from "express";
import { LIMITS, activateProjectSchema, projectPatchSchema, projectWriteSchema } from "rotina-bonette-shared";
import { AppError, notFound } from "../lib/errors.js";
import { asDate, asyncHandler, parse } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

async function assertActiveSlot(exceptId?: string, parkProjectId?: string) {
  return prisma.$transaction(async (tx) => {
    const active = await tx.project.findMany({
      where: { status: "ACTIVE", ...(exceptId ? { NOT: { id: exceptId } } : {}) },
      select: { id: true, name: true },
    });
    if (active.length < LIMITS.activeProjects) return;
    if (!parkProjectId || !active.some((project) => project.id === parkProjectId)) {
      throw new AppError(409, "ACTIVE_PROJECT_LIMIT_REACHED", "Já existem 4 projetos ativos.", {
        active,
      });
    }
    await tx.project.update({ where: { id: parkProjectId }, data: { status: "PARKED" } });
  });
}

export const projectsRouter = Router();

projectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const projects = await prisma.project.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
    res.json({ projects });
  }),
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(projectWriteSchema, req.body);
    if (input.status === "ACTIVE") await assertActiveSlot();
    const project = await prisma.project.create({
      data: {
        name: input.name,
        description: input.description ?? "",
        color: input.color,
        icon: input.icon ?? "folder",
        status: input.status ?? "PARKED",
        priority: input.priority ?? "P3",
        category: input.category ?? "PERSONAL",
        deadline: asDate(input.deadline) ?? null,
        progress: input.progress ?? 0,
        notes: input.notes ?? null,
        sortOrder: input.sortOrder ?? 0,
        archivedAt: input.status === "ARCHIVED" ? new Date() : null,
      },
    });
    res.status(201).json({ project });
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        tasks: { orderBy: [{ status: "asc" }, { sortOrder: "asc" }] },
        blocks: { orderBy: { startAt: "asc" }, take: 20 },
      },
    });
    if (!project) throw notFound("Projeto não encontrado.");
    res.json({ project });
  }),
);

projectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(projectPatchSchema, req.body);
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Projeto não encontrado.");
    if (input.status === "ACTIVE" && existing.status !== "ACTIVE") {
      await assertActiveSlot(existing.id);
    }
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.deadline !== undefined ? { deadline: asDate(input.deadline) } : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.status === "ARCHIVED" ? { archivedAt: new Date() } : {}),
        ...(input.status && input.status !== "ARCHIVED" ? { archivedAt: null } : {}),
      },
    });
    res.json({ project });
  }),
);

projectsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Projeto não encontrado.");
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    res.json({ project });
  }),
);

projectsRouter.post(
  "/:id/activate",
  asyncHandler(async (req, res) => {
    const input = parse(activateProjectSchema, req.body ?? {});
    const project = await prisma.$transaction(async (tx) => {
      const existing = await tx.project.findUnique({ where: { id: req.params.id } });
      if (!existing) throw notFound("Projeto não encontrado.");
      if (existing.status !== "ACTIVE") {
        const active = await tx.project.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
        });
        if (active.length >= LIMITS.activeProjects) {
          if (!input.parkProjectId || !active.some((item) => item.id === input.parkProjectId)) {
            throw new AppError(409, "ACTIVE_PROJECT_LIMIT_REACHED", "Já existem 4 projetos ativos.", { active });
          }
          await tx.project.update({ where: { id: input.parkProjectId }, data: { status: "PARKED" } });
        }
      }
      return tx.project.update({
        where: { id: existing.id },
        data: { status: "ACTIVE", archivedAt: null },
      });
    });
    res.json({ project });
  }),
);

projectsRouter.post(
  "/:id/park",
  asyncHandler(async (req, res) => {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Projeto não encontrado.");
    const project = await prisma.project.update({
      where: { id: existing.id },
      data: { status: "PARKED", archivedAt: null },
    });
    res.json({ project });
  }),
);
