export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PROJECT_STATUSES = ["ACTIVE", "MAINTENANCE", "PARKED", "ARCHIVED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_CATEGORIES = [
  "CLIENT",
  "WORK",
  "PERSONAL",
  "PORTFOLIO",
  "MAINTENANCE",
  "LEARNING",
] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export const TASK_STATUSES = [
  "INBOX",
  "BACKLOG",
  "THIS_WEEK",
  "TODAY",
  "DOING",
  "WAITING",
  "DONE",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ENERGY_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];

export const IDEA_STATUSES = ["INBOX", "REVIEWED", "CONVERTED", "DISCARDED"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const CALENDAR_TYPES = ["DEEP_FOCUS", "TASK", "ROUTINE", "MEETING", "PERSONAL"] as const;
export type CalendarType = (typeof CALENDAR_TYPES)[number];

export const FOCUS_STATUSES = ["RUNNING", "COMPLETED", "CANCELLED"] as const;
export type FocusStatus = (typeof FOCUS_STATUSES)[number];

export const THEMES = ["dark", "light", "system"] as const;
export type ThemeSetting = (typeof THEMES)[number];

export const LIMITS = {
  today: 3,
  doing: 1,
  activeProjects: 4,
  pinLength: 4,
  maxPinAttempts: 5,
  pinWindowMinutes: 15,
} as const;

export const BACKUP_VERSION = 1;

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  INBOX: "Inbox",
  BACKLOG: "Backlog",
  THIS_WEEK: "Esta Semana",
  TODAY: "Hoje",
  DOING: "Fazendo",
  WAITING: "Aguardando",
  DONE: "Concluído",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  ACTIVE: "Ativos",
  MAINTENANCE: "Manutenção",
  PARKED: "Estacionados",
  ARCHIVED: "Arquivados",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: "P1 · agora",
  P2: "P2 · importante",
  P3: "P3 · contínuo",
  P4: "P4 · baixa",
};

export const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  CLIENT: "Cliente",
  WORK: "Trabalho",
  PERSONAL: "Pessoal",
  PORTFOLIO: "Portfólio",
  MAINTENANCE: "Manutenção",
  LEARNING: "Estudo",
};

export const CALENDAR_TYPE_LABEL: Record<CalendarType, string> = {
  DEEP_FOCUS: "Foco profundo",
  TASK: "Tarefa",
  ROUTINE: "Rotina",
  MEETING: "Compromisso",
  PERSONAL: "Pessoal",
};

export const DAILY_RANK_LABEL = ["Principal", "Alternativa", "Pequena"] as const;

export const ENERGY_LABEL: Record<EnergyLevel, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
};
