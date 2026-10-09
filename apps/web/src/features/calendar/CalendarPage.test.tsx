import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CalendarPage } from "./CalendarPage";

vi.mock("@fullcalendar/react", () => ({
  default: ({ select }: { select: (arg: { start: Date; end: Date }) => void }) => (
    <button type="button" onClick={() => select({ start: new Date("2026-10-08T14:00:00"), end: new Date("2026-10-08T15:00:00") })}>
      Selecionar horário
    </button>
  ),
}));
vi.mock("@fullcalendar/daygrid", () => ({ default: {} }));
vi.mock("@fullcalendar/timegrid", () => ({ default: {} }));
vi.mock("@fullcalendar/interaction", () => ({ default: {} }));
vi.mock("@fullcalendar/core/locales/pt-br", () => ({ default: {} }));

vi.mock("../../lib/api", () => ({
  api: (path: string) => {
    if (path === "/settings") return Promise.resolve({ settings: { weekStartsOn: 1, theme: "dark", defaultFocusMinutes: 25, sessionIdleHours: 12, showCompletedDays: 7 } });
    if (path === "/projects") return Promise.resolve({ projects: [] });
    if (path.startsWith("/tasks")) return Promise.resolve({ tasks: [] });
    if (path.startsWith("/calendar")) return Promise.resolve({ blocks: [] });
    return Promise.resolve({});
  },
}));

describe("calendário", () => {
  it("abre o formulário ao selecionar um horário", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <CalendarPage />
      </QueryClientProvider>,
    );
    (await screen.findByText("Selecionar horário")).click();
    expect(await screen.findByTestId("calendar-form")).toBeInTheDocument();
  });
});
