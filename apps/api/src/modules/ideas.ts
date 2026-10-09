import { Router } from "express";
import {
  convertIdeaProjectSchema,
  convertIdeaTaskSchema,
  ideaPatchSchema,
  ideaWriteSchema,
} from "rotina-bonette-shared";
import { AppError, notFound } from "../lib/errors.js";
import { asyncHandler, parse } from "../lib/http.js";
import { presentTask, taskInclude } from "../lib/present.js";
import { prisma } from "../lib/prisma.js";

export const ideasRouter = Router();

ideasRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const ideas = await prisma.idea.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ ideas });
  }),
);

ideasRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(ideaWriteSchema, req.body);
    const idea = await prisma.idea.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        category: input.category ?? null,
        status: "INBOX",
      },
    });
    res.status(201).json({ idea });
  }),
);

ideasRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const input = parse(ideaPatchSchema, req.body);
    const existing = await prisma.idea.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Ideia não encontrada.");
    if (existing.status === "CONVERTED" && input.status && input.status !== "CONVERTED") {
      throw new AppError(409, "CONFLICT", "Ideia já convertida não volta para a inbox.");
    }
    const idea = await prisma.idea.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
    res.json({ idea });
  }),
);

ideasRouter.post(
  "/:id/convert-to-task",
  asyncHandler(async (req, res) => {
    const input = parse(convertIdeaTaskSchema, req.body ?? {});
    const result = await prisma.$transaction(async (tx) => {
      const idea = await tx.idea.findUnique({ where: { id: req.params.id } });
      if (!idea) throw notFound("Ideia não encontrada.");
      if (idea.status === "CONVERTED" || idea.status === "DISCARDED") {
        throw new AppError(409, "CONFLICT", "Essa ideia não pode ser convertida.");
      }
      const task = await tx.task.create({
        data: {
          title: idea.title,
          description: idea.description,
          projectId: input.projectId ?? null,
          priority: input.priority ?? "P4",
          status: "INBOX",
        },
        include: taskInclude,
      });
      const updated = await tx.idea.update({
        where: { id: idea.id },
        data: { status: "CONVERTED", convertedTaskId: task.id },
      });
      return { idea: updated, task };
    });
    res.status(201).json({ idea: result.idea, task: await presentTask(result.task) });
  }),
);

ideasRouter.post(
  "/:id/convert-to-project",
  asyncHandler(async (req, res) => {
    const input = parse(convertIdeaProjectSchema, req.body ?? {});
    const result = await prisma.$transaction(async (tx) => {
      const idea = await tx.idea.findUnique({ where: { id: req.params.id } });
      if (!idea) throw notFound("Ideia não encontrada.");
      if (idea.status === "CONVERTED" || idea.status === "DISCARDED") {
        throw new AppError(409, "CONFLICT", "Essa ideia não pode ser convertida.");
      }
      const project = await tx.project.create({
        data: {
          name: idea.title,
          description: idea.description ?? "",
          color: input.color ?? "#4c86ff",
          status: "PARKED",
          priority: input.priority ?? "P4",
          category: input.category ?? "PERSONAL",
        },
      });
      const updated = await tx.idea.update({
        where: { id: idea.id },
        data: { status: "CONVERTED", convertedProjectId: project.id },
      });
      return { idea: updated, project };
    });
    res.status(201).json(result);
  }),
);

ideasRouter.post(
  "/:id/discard",
  asyncHandler(async (req, res) => {
    const existing = await prisma.idea.findUnique({ where: { id: req.params.id } });
    if (!existing) throw notFound("Ideia não encontrada.");
    const idea = await prisma.idea.update({
      where: { id: existing.id },
      data: { status: "DISCARDED" },
    });
    res.json({ idea });
  }),
);
