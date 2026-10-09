import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { BACKUP_VERSION, backupSchema, settingsPatchSchema, wipeSchema } from "rotina-bonette-shared";
import { AppError } from "../lib/errors.js";
import { asyncHandler, parse } from "../lib/http.js";
import { prisma } from "../lib/prisma.js";

const backupDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data/backups");

export async function getSettings() {
  return prisma.appSettings.upsert({
    where: { id: "app" },
    update: {},
    create: { id: "app" },
  });
}

function dateOrNull(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function exportData() {
  const [projects, tasks, ideas, calendarBlocks, routines, focusSessions, settings] = await Promise.all([
    prisma.project.findMany(),
    prisma.task.findMany(),
    prisma.idea.findMany(),
    prisma.calendarBlock.findMany(),
    prisma.routine.findMany(),
    prisma.focusSession.findMany(),
    getSettings(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    projects: projects.map((project) => ({
      ...project,
      deadline: dateOrNull(project.deadline),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      archivedAt: dateOrNull(project.archivedAt),
    })),
    tasks: tasks.map((task) => ({
      ...task,
      dueDate: dateOrNull(task.dueDate),
      scheduledDate: dateOrNull(task.scheduledDate),
      completedAt: dateOrNull(task.completedAt),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    ideas: ideas.map((idea) => ({
      ...idea,
      createdAt: idea.createdAt.toISOString(),
      updatedAt: idea.updatedAt.toISOString(),
    })),
    calendarBlocks: calendarBlocks.map((block) => ({
      ...block,
      startAt: block.startAt.toISOString(),
      endAt: block.endAt.toISOString(),
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    })),
    routines: routines.map((routine) => ({
      ...routine,
      createdAt: routine.createdAt.toISOString(),
      updatedAt: routine.updatedAt.toISOString(),
    })),
    focusSessions: focusSessions.map((session) => ({
      ...session,
      startedAt: session.startedAt.toISOString(),
      endedAt: dateOrNull(session.endedAt),
      createdAt: session.createdAt.toISOString(),
    })),
    settings: {
      ...settings,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    },
  };
}

async function writeSafetyBackup() {
  await mkdir(backupDir, { recursive: true });
  const payload = await exportData();
  const file = path.join(backupDir, `antes-import-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(payload, null, 2));
  return file;
}

function at(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export const settingsRouter = Router();

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json({ settings: await getSettings() });
  }),
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const input = parse(settingsPatchSchema, req.body);
    const settings = await prisma.appSettings.upsert({
      where: { id: "app" },
      update: input,
      create: { id: "app", ...input },
    });
    if (input.sessionIdleHours) {
      req.session.cookie.maxAge = input.sessionIdleHours * 60 * 60 * 1000;
    }
    res.json({ settings });
  }),
);

settingsRouter.post(
  "/export",
  asyncHandler(async (_req, res) => {
    const payload = await exportData();
    res.setHeader("Content-Disposition", 'attachment; filename="rotina-bonette-backup.json"');
    res.json(payload);
  }),
);

settingsRouter.post(
  "/import",
  asyncHandler(async (req, res) => {
    const backup = parse(backupSchema, req.body);
    const taskIds = new Set(backup.tasks.map((task) => task.id));
    const projectIds = new Set(backup.projects.map((project) => project.id));
    const brokenTask = backup.tasks.some((task) => task.projectId && !projectIds.has(task.projectId));
    const brokenFocus = backup.focusSessions.some((session) => !taskIds.has(session.taskId));
    const brokenIdea = backup.ideas.some(
      (idea) =>
        (idea.convertedTaskId && !taskIds.has(idea.convertedTaskId)) ||
        (idea.convertedProjectId && !projectIds.has(idea.convertedProjectId)),
    );
    const brokenBlock = backup.calendarBlocks.some(
      (block) =>
        (block.projectId && !projectIds.has(block.projectId)) || (block.taskId && !taskIds.has(block.taskId)),
    );
    const doing = backup.tasks.filter((task) => task.status === "DOING").length;
    const today = backup.tasks.filter((task) => task.status === "TODAY").length;
    const active = backup.projects.filter((project) => project.status === "ACTIVE").length;
    if (brokenTask || brokenFocus || brokenIdea || brokenBlock || doing > 1 || today > 3 || active > 4) {
      throw new AppError(400, "VALIDATION_ERROR", "O backup viola relações ou limites da v1.");
    }

    const safetyFile = await writeSafetyBackup();
    await prisma.$transaction(async (tx) => {
      await tx.focusSession.deleteMany();
      await tx.calendarBlock.deleteMany();
      await tx.idea.deleteMany();
      await tx.routine.deleteMany();
      await tx.task.deleteMany();
      await tx.project.deleteMany();
      if (backup.projects.length) {
        await tx.project.createMany({
          data: backup.projects.map((project) => ({
            ...project,
            deadline: at(project.deadline),
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
            archivedAt: at(project.archivedAt),
          })),
        });
      }
      if (backup.tasks.length) {
        await tx.task.createMany({
          data: backup.tasks.map((task) => ({
            ...task,
            dueDate: at(task.dueDate),
            scheduledDate: at(task.scheduledDate),
            completedAt: at(task.completedAt),
            createdAt: new Date(task.createdAt),
            updatedAt: new Date(task.updatedAt),
          })),
        });
      }
      if (backup.ideas.length) {
        await tx.idea.createMany({
          data: backup.ideas.map((idea) => ({
            ...idea,
            createdAt: new Date(idea.createdAt),
            updatedAt: new Date(idea.updatedAt),
          })),
        });
      }
      if (backup.calendarBlocks.length) {
        await tx.calendarBlock.createMany({
          data: backup.calendarBlocks.map((block) => ({
            ...block,
            startAt: new Date(block.startAt),
            endAt: new Date(block.endAt),
            createdAt: new Date(block.createdAt),
            updatedAt: new Date(block.updatedAt),
          })),
        });
      }
      if (backup.routines.length) {
        await tx.routine.createMany({
          data: backup.routines.map((routine) => ({
            ...routine,
            createdAt: new Date(routine.createdAt),
            updatedAt: new Date(routine.updatedAt),
          })),
        });
      }
      if (backup.focusSessions.length) {
        await tx.focusSession.createMany({
          data: backup.focusSessions.map((session) => ({
            ...session,
            startedAt: new Date(session.startedAt),
            endedAt: at(session.endedAt),
            createdAt: new Date(session.createdAt),
          })),
        });
      }
      await tx.appSettings.upsert({
        where: { id: "app" },
        update: {
          theme: backup.settings.theme,
          weekStartsOn: backup.settings.weekStartsOn,
          defaultFocusMinutes: backup.settings.defaultFocusMinutes,
          sessionIdleHours: backup.settings.sessionIdleHours,
          showCompletedDays: backup.settings.showCompletedDays,
        },
        create: {
          id: "app",
          theme: backup.settings.theme,
          weekStartsOn: backup.settings.weekStartsOn,
          defaultFocusMinutes: backup.settings.defaultFocusMinutes,
          sessionIdleHours: backup.settings.sessionIdleHours,
          showCompletedDays: backup.settings.showCompletedDays,
        },
      });
    });
    res.json({ ok: true, safetyFile: path.basename(safetyFile) });
  }),
);

settingsRouter.post(
  "/wipe",
  asyncHandler(async (req, res) => {
    parse(wipeSchema, req.body);
    const safetyFile = await writeSafetyBackup();
    await prisma.$transaction([
      prisma.focusSession.deleteMany(),
      prisma.calendarBlock.deleteMany(),
      prisma.idea.deleteMany(),
      prisma.routine.deleteMany(),
      prisma.task.deleteMany(),
      prisma.project.deleteMany(),
      prisma.appSettings.upsert({
        where: { id: "app" },
        update: {
          theme: "system",
          weekStartsOn: 1,
          defaultFocusMinutes: 25,
          sessionIdleHours: 12,
          showCompletedDays: 7,
        },
        create: { id: "app" },
      }),
    ]);
    res.json({ ok: true, safetyFile: path.basename(safetyFile) });
  }),
);
