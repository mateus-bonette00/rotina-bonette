import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FocusPage } from "./FocusPage";

vi.mock("../../lib/api", () => ({
  api: (path: string) => {
    if (path === "/focus/current") {
      return Promise.resolve({
        session: {
          id: "s1",
          taskId: "t1",
          startedAt: new Date().toISOString(),
          plannedMinutes: 25,
          status: "RUNNING",
          notes: null,
          endedAt: null,
          actualMinutes: null,
          task: { id: "t1", title: "Bloco de teste", project: { name: "OdontoClin" }, nextAction: "Comparar" },
        },
      });
    }
    return Promise.resolve({ tasks: [] });
  },
  ApiError: class ApiError extends Error {},
}));

describe("foco", () => {
  it("mostra a tarefa e o timer", async () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <FocusPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("focus-task")).toHaveTextContent("Bloco de teste");
    expect(screen.getByTestId("focus-timer").textContent).toMatch(/\d{2}:\d{2}/);
  });
});
