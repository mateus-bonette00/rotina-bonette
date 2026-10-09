import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { KanbanPage } from "./KanbanPage";

vi.mock("../../lib/api", () => {
  class MockError extends Error {
    status: number;
    code: string;
    details: Record<string, unknown>;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
      this.details = {};
    }
  }
  return {
    ApiError: MockError,
    api: (path: string, init?: RequestInit) => {
      if (path.startsWith("/tasks") && (!init || !init.method || init.method === "GET")) {
        return Promise.resolve({
          tasks: [
            { id: "a", title: "Uma", status: "TODAY", priority: "P1", project: null },
            { id: "b", title: "Duas", status: "TODAY", priority: "P2", project: null },
            { id: "c", title: "Três", status: "TODAY", priority: "P3", project: null },
            { id: "d", title: "Quatro", status: "BACKLOG", priority: "P3", project: null },
          ],
        });
      }
      if (path === "/projects") return Promise.resolve({ projects: [] });
      return Promise.reject(new MockError(409, "TODAY_LIMIT_REACHED", "Hoje já possui 3 tarefas."));
    },
  };
});

describe("kanban", () => {
  it("mostra o erro de limite de hoje", async () => {
    localStorage.setItem(
      "rotina.kanban.board_lists.v3",
      JSON.stringify([{ id: "BACKLOG", title: "Lista", status: "BACKLOG" }]),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <KanbanPage />
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/Hoje 3\/3/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText("Mover Quatro"), "TODAY");
    expect(await screen.findByTestId("kanban-error")).toHaveTextContent("Hoje já possui 3 tarefas.");
  });
});
