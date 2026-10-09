import { describe, expect, it } from "vitest";
import { scoreTask } from "./score.js";

const now = new Date(2026, 9, 8, 12, 0, 0);

const base = {
  priority: "P3" as const,
  dueDate: null,
  externalCommitment: false,
  estimatedMinutes: null,
  blocked: false,
  projectStatus: "ACTIVE" as const,
  unblocksWork: false,
  now,
};

describe("scoreTask", () => {
  it("prioriza P1 acima de P4", () => {
    const p1 = scoreTask({ ...base, priority: "P1" });
    const p4 = scoreTask({ ...base, priority: "P4" });
    expect(p1.score).toBeGreaterThan(p4.score);
    expect(p1.reasons.some((reason) => reason.label === "Prioridade P1")).toBe(true);
  });

  it("explica prazo, obrigação externa e quick win", () => {
    const result = scoreTask({
      ...base,
      priority: "P1",
      dueDate: new Date(2026, 9, 8),
      externalCommitment: true,
      estimatedMinutes: 25,
    });
    const labels = result.reasons.map((reason) => reason.label);
    expect(labels).toContain("Vence hoje");
    expect(labels).toContain("Obrigação externa");
    expect(labels).toContain("Quick win (até 30 min)");
    expect(labels).toContain("Projeto ativo");
    expect(result.score).toBe(40 + 30 + 15 + 5);
  });

  it("penaliza bloqueio e projeto estacionado", () => {
    const blocked = scoreTask({ ...base, blocked: true });
    const parked = scoreTask({ ...base, projectStatus: "PARKED", blocked: false });
    expect(blocked.reasons.some((reason) => reason.points === -100)).toBe(true);
    expect(parked.score).toBeLessThan(0);
  });

  it("diferencia atraso, 3 dias e 7 dias", () => {
    expect(scoreTask({ ...base, dueDate: new Date(2026, 9, 7) }).reasons[1]?.points).toBe(35);
    expect(scoreTask({ ...base, dueDate: new Date(2026, 9, 10) }).reasons[1]?.points).toBe(20);
    expect(scoreTask({ ...base, dueDate: new Date(2026, 9, 14) }).reasons[1]?.points).toBe(10);
    expect(scoreTask({ ...base, dueDate: new Date(2026, 9, 20) }).reasons).toHaveLength(2);
  });
});
