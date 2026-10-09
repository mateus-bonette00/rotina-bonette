import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const api = vi.fn();

vi.mock("../../lib/api", () => ({
  api: (...args: unknown[]) => api(...args),
  setCsrf: vi.fn(),
  ApiError: class ApiError extends Error {
    status = 401;
    code = "INVALID_PIN";
    details = {};
  },
}));

vi.mock("../../hooks/useSession", () => ({
  useSession: () => ({ isLoading: false, data: { authenticated: false, user: null, csrfToken: null } }),
}));

function renderLogin() {
  const router = createMemoryRouter([{ path: "/login", element: <LoginPage /> }], { initialEntries: ["/login"] });
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("login", () => {
  beforeEach(() => api.mockReset());

  it("mostra o teclado e não revela o PIN", async () => {
    renderLogin();
    expect(screen.getByRole("heading", { name: "Rotina Bonette" })).toBeInTheDocument();
    expect(screen.getByTestId("pin-dots").textContent).toBe("");
    await userEvent.click(screen.getByTestId("pin-key-1"));
    await userEvent.click(screen.getByTestId("pin-key-2"));
    expect(screen.queryByText("12")).not.toBeInTheDocument();
  });
});
