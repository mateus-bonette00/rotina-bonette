import { describe, expect, it } from "vitest";
import { BACKUP_VERSION } from "./domain.js";
import { backupSchema } from "./schemas.js";

const settings = {
  id: "app",
  theme: "system",
  weekStartsOn: 1,
  defaultFocusMinutes: 25,
  sessionIdleHours: 12,
  showCompletedDays: 7,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
};
const backup = (extra: object) => ({
  version: BACKUP_VERSION,
  exportedAt: "2026-10-15T00:00:00.000Z",
  projects: [],
  tasks: [],
  ideas: [],
  calendarBlocks: [],
  routines: [],
  focusSessions: [],
  settings: { ...settings, ...extra },
});

describe("backupSchema", () => {
  it("mantém as listas do Kanban no backup", () => {
    const kanbanBoard = { columns: [{ id: "c1", title: "Ideias", status: "BACKLOG", isCustom: true }], taskMap: { t1: "c1" } };
    expect(backupSchema.parse(backup({ kanbanBoard })).settings.kanbanBoard).toEqual(kanbanBoard);
  });

  it("aceita quadro vazio e backup antigo sem quadro", () => {
    expect(backupSchema.parse(backup({ kanbanBoard: {} })).settings.kanbanBoard).toBeUndefined();
    expect(backupSchema.parse(backup({})).settings.kanbanBoard).toBeUndefined();
  });
});
