import { describe, expect, it } from "vitest";
import { expandRoutine, type RoutineSeries } from "./routine.js";

const base: RoutineSeries = { daysOfWeek: [5], startTime: "10:30", durationMinutes: 60, intervalWeeks: 1, anchorDate: null, dayTimes: {} };

describe("expandRoutine", () => {
  it("repete toda semana e marca pausa sem apagar a série", () => {
    const out = expandRoutine(base, [{ startDate: "2026-10-09", endDate: "2026-10-23" }], "2026-10-05", "2026-11-01");
    expect(out.map((o) => [o.date, o.paused])).toEqual([
      ["2026-10-09", true],
      ["2026-10-16", true],
      ["2026-10-23", true],
      ["2026-10-30", false],
    ]);
  });

  it("quinzenal respeita a âncora, inclusive antes dela", () => {
    const series = { ...base, intervalWeeks: 2, anchorDate: "2026-10-09" };
    const dates = expandRoutine(series, [], "2026-09-25", "2026-10-31").map((o) => o.date);
    expect(dates).toEqual(["2026-09-25", "2026-10-09", "2026-10-23"]);
  });

  it("usa horário próprio por dia", () => {
    const series = { ...base, daysOfWeek: [3, 4], dayTimes: { "3": { startTime: "14:00", durationMinutes: 180 } } };
    const out = expandRoutine(series, [], "2026-10-14", "2026-10-15");
    expect(out.map((o) => [o.startTime, o.durationMinutes])).toEqual([["14:00", 180], ["10:30", 60]]);
  });
});
