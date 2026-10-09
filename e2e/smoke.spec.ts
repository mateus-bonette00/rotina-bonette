import { expect, test } from "@playwright/test";

const pin = process.env.E2E_PIN ?? "0708";

test("entra, move uma tarefa, inicia, conclui e sai", async ({ page }) => {
  await page.goto("/login");
  for (const digit of pin) {
    await page.getByTestId(`pin-key-${digit}`).click();
  }
  await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();

  await page.getByRole("link", { name: "Kanban" }).click();
  await page.getByRole("button", { name: "Adicionar um cartão" }).click();
  await page.getByPlaceholder("Insira um título para este cartão...").fill("Tarefa e2e");
  await page.getByRole("button", { name: "Adicionar cartão" }).click();
  await expect(page.getByLabel("Mover Tarefa e2e")).toBeVisible();
  await page.getByLabel("Mover Tarefa e2e").selectOption("WAITING");
  await expect(page.getByLabel("Mover Tarefa e2e")).toHaveValue("WAITING");
  await page.getByLabel("Mover Tarefa e2e").selectOption("DONE");
  await expect(page.getByLabel("Mover Tarefa e2e")).toHaveValue("DONE");
  await page.getByTestId("logout").click();
  await expect(page.getByRole("heading", { name: "Rotina Bonette" })).toBeVisible();
});
