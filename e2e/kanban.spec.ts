import { expect, test } from "@playwright/test";

const pin = process.env.E2E_PIN ?? "0708";
const stamp = Date.now();
const first = `Ordem A ${stamp}`;
const second = `Ordem B ${stamp}`;

test("reordena cards com o mouse e apaga tarefa com confirmação", async ({ page }) => {
  await page.goto("/login");
  for (const digit of pin) {
    await page.getByTestId(`pin-key-${digit}`).click();
  }
  await page.getByRole("link", { name: "Kanban" }).click();

  const column = page.getByTestId("column-BACKLOG").first();
  for (const title of [first, second]) {
    await column.getByRole("button", { name: "Adicionar um cartão" }).click();
    await column.getByRole("textbox").fill(title);
    await column.getByRole("button", { name: "Adicionar cartão" }).click();
    await expect(column.getByText(title)).toBeVisible();
  }

  const titles = () => column.locator("article").locator("button").filter({ hasText: /Ordem [AB]/ }).allTextContents();
  expect((await titles()).filter((t) => t.includes(String(stamp)))).toEqual([first, second]);

  // arrasta B para cima de A
  const a = await column.locator("article", { hasText: first }).boundingBox();
  const b = await column.locator("article", { hasText: second }).boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width / 2, b!.y - 10, { steps: 5 });
  await page.mouse.move(a!.x + a!.width / 2, a!.y + 5, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () => (await titles()).filter((t) => t.includes(String(stamp)))).toEqual([second, first]);
  await page.reload();
  await expect.poll(async () => (await titles()).filter((t) => t.includes(String(stamp)))).toEqual([second, first]);

  // apaga com confirmação (inclui sobras de execuções anteriores que falharam)
  const leftovers = page.getByRole("button", { name: /^Ordem [AB] \d+$/ });
  while ((await leftovers.count()) > 0) {
    await leftovers.first().click();
    await page.getByRole("button", { name: "Apagar Tarefa" }).click();
    await expect(page.getByText("Apagar tarefa?")).toBeVisible();
    await page.getByTestId("confirm-delete").click();
    await expect(page.getByRole("heading", { name: "Editar Tarefa" })).toBeHidden();
  }
  await expect(page.getByText(first)).toHaveCount(0);
  await expect(page.getByText(second)).toHaveCount(0);
});
