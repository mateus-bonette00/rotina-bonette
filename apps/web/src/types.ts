import type {
  CalendarType,
  EnergyLevel,
  IdeaStatus,
  Priority,
  ProjectCategory,
  ProjectStatus,
  ScoreReason,
  TaskStatus,
  ThemeSetting,
} from "rotina-bonette-shared";

export type ProjectRef = {
  id: string;
  name: string;
  color: string;
  icon: string;
  status: ProjectStatus;
  priority: Priority;
};

export type Task = {
  id: string;
  projectId: string | null;
  project: ProjectRef | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dailyRank: number | null;
  estimatedMinutes: number | null;
  energy: EnergyLevel;
  aversion: EnergyLevel;
  dueDate: string | null;
  scheduledDate: string | null;
  externalCommitment: boolean;
  blocked: boolean;
  blockReason: string | null;
  nextAction: string | null;
  sortOrder: number;
  completedAt: string | null;
  score?: number;
  reasons?: ScoreReason[];
};

export type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  status: ProjectStatus;
  priority: Priority;
  category: ProjectCategory;
  deadline: string | null;
  progress: number;
  notes: string | null;
  sortOrder: number;
  archivedAt: string | null;
};

export type Idea = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: IdeaStatus;
  convertedTaskId: string | null;
  convertedProjectId: string | null;
};

export type CalendarBlock = {
  id: string;
  title: string;
  projectId: string | null;
  taskId: string | null;
  type: CalendarType;
  startAt: string;
  endAt: string;
  notes: string | null;
  project?: { id: string; name: string; color: string } | null;
  task?: { id: string; title: string } | null;
};

export type Routine = {
  id: string;
  name: string;
  projectId: string | null;
  enabled: boolean;
  daysOfWeek: number[];
  startTime: string | null;
  durationMinutes: number;
  type: string;
  notes: string | null;
  project?: { id: string; name: string; color: string } | null;
};

export type FocusSession = {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
  status: "RUNNING" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  task?: { id: string; title: string; project?: { name: string; color: string } | null; nextAction?: string | null };
};

export type Settings = {
  theme: ThemeSetting;
  weekStartsOn: number;
  defaultFocusMinutes: number;
  sessionIdleHours: number;
  showCompletedDays: number;
};
