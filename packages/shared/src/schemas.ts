import { z } from "zod";
import {
  BACKUP_VERSION,
  CALENDAR_TYPES,
  ENERGY_LEVELS,
  IDEA_STATUSES,
  PRIORITIES,
  PROJECT_CATEGORIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  THEMES,
} from "./domain.js";

export const pinSchema = z.string().regex(/^\d{4}$/, "O PIN precisa ter exatamente 4 números.");

export const loginSchema = z.object({ pin: pinSchema });

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

const optionalDate = z.union([z.string().min(1), z.null()]).optional();

export const projectWriteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(5000).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  icon: z.string().trim().min(1).max(40).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  deadline: optionalDate,
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().max(20000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const projectPatchSchema = projectWriteSchema.partial();

export const taskWriteSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dailyRank: z.number().int().min(1).max(3).nullable().optional(),
  estimatedMinutes: z.number().int().min(1).max(24 * 60).nullable().optional(),
  energy: z.enum(ENERGY_LEVELS).optional(),
  aversion: z.enum(ENERGY_LEVELS).optional(),
  dueDate: optionalDate,
  scheduledDate: optionalDate,
  externalCommitment: z.boolean().optional(),
  blocked: z.boolean().optional(),
  blockReason: z.string().max(500).nullable().optional(),
  nextAction: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
  confirmReplace: z.boolean().optional(),
});

export const taskPatchSchema = taskWriteSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Nada para atualizar.",
});

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  sortOrder: z.number().int().optional(),
  confirmReplace: z.boolean().optional(),
});

export const reorderTasksSchema = z.object({
  status: z.enum(TASK_STATUSES),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const ideaWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).nullable().optional(),
  category: z.string().max(80).nullable().optional(),
  status: z.enum(IDEA_STATUSES).optional(),
});

export const ideaPatchSchema = ideaWriteSchema.partial();

export const convertIdeaTaskSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export const convertIdeaProjectSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  category: z.enum(PROJECT_CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
});

export const calendarWriteSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    projectId: z.string().min(1).nullable().optional(),
    taskId: z.string().min(1).nullable().optional(),
    type: z.enum(CALENDAR_TYPES),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    message: "O fim precisa ser depois do início.",
    path: ["endAt"],
  });

export const calendarPatchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    projectId: z.string().min(1).nullable().optional(),
    taskId: z.string().min(1).nullable().optional(),
    type: z.enum(CALENDAR_TYPES).optional(),
    startAt: z.string().min(1).optional(),
    endAt: z.string().min(1).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine(
    (value) => {
      if (!value.startAt || !value.endAt) return true;
      return new Date(value.endAt).getTime() > new Date(value.startAt).getTime();
    },
    { message: "O fim precisa ser depois do início.", path: ["endAt"] },
  );

export const routineWriteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  projectId: z.string().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(12 * 60),
  type: z.string().trim().min(1).max(40),
  notes: z.string().max(5000).nullable().optional(),
});

export const routinePatchSchema = routineWriteSchema.partial();

export const focusStartSchema = z.object({
  taskId: z.string().min(1),
  plannedMinutes: z.number().int().min(1).max(240).optional(),
  confirmReplace: z.boolean().optional(),
});

export const focusEndSchema = z.object({
  notes: z.string().max(5000).nullable().optional(),
  actualMinutes: z.number().int().min(0).max(24 * 60).optional(),
});

export const settingsPatchSchema = z.object({
  theme: z.enum(THEMES).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  defaultFocusMinutes: z.number().int().min(5).max(180).optional(),
  sessionIdleHours: z.number().int().min(1).max(24 * 14).optional(),
  showCompletedDays: z.number().int().min(1).max(90).optional(),
});

export const activateProjectSchema = z.object({
  parkProjectId: z.string().min(1).optional(),
});

export const wipeSchema = z.object({
  confirmation: z.literal("APAGAR TUDO"),
});

const backupProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  color: z.string(),
  icon: z.string(),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PRIORITIES),
  category: z.enum(PROJECT_CATEGORIES),
  deadline: z.string().nullable(),
  progress: z.number().int(),
  notes: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
});

const backupTaskSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  dailyRank: z.number().int().nullable(),
  estimatedMinutes: z.number().int().nullable(),
  energy: z.enum(ENERGY_LEVELS),
  aversion: z.enum(ENERGY_LEVELS),
  dueDate: z.string().nullable(),
  scheduledDate: z.string().nullable(),
  externalCommitment: z.boolean(),
  blocked: z.boolean(),
  blockReason: z.string().nullable(),
  nextAction: z.string().nullable(),
  sortOrder: z.number().int(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const backupSchema = z.object({
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.string(),
  projects: z.array(backupProjectSchema),
  tasks: z.array(backupTaskSchema),
  ideas: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string().nullable(),
      category: z.string().nullable(),
      status: z.enum(IDEA_STATUSES),
      convertedTaskId: z.string().nullable(),
      convertedProjectId: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  calendarBlocks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      projectId: z.string().nullable(),
      taskId: z.string().nullable(),
      type: z.enum(CALENDAR_TYPES),
      startAt: z.string(),
      endAt: z.string(),
      notes: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  routines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      projectId: z.string().nullable(),
      enabled: z.boolean(),
      daysOfWeek: z.array(z.number().int()),
      startTime: z.string().nullable(),
      durationMinutes: z.number().int(),
      type: z.string(),
      notes: z.string().nullable(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  focusSessions: z.array(
    z.object({
      id: z.string(),
      taskId: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      plannedMinutes: z.number().int().nullable(),
      actualMinutes: z.number().int().nullable(),
      status: z.enum(["RUNNING", "COMPLETED", "CANCELLED"]),
      notes: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  settings: z.object({
    id: z.string(),
    theme: z.enum(THEMES),
    weekStartsOn: z.number().int(),
    defaultFocusMinutes: z.number().int(),
    sessionIdleHours: z.number().int(),
    showCompletedDays: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

export type BackupFile = z.infer<typeof backupSchema>;
