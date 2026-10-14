import { expect, test, type Locator, type Page } from "@playwright/test";

const pin = process.env.E2E_PIN ?? "0708";
const stamp = Date.now();

async function openKanban(page: Page) {
  await page.goto("/login");
  for (const digit of pin) {
    await page.getByTestId(`pin-key-${digit}`).click();
  }
  await page.getByRole("link", { name: "Kanban" }).click();
}

const list = (page: Page, name: string) =>
  page.locator("section", { has: page.getByRole("heading", { name, exact: true }) });

const titles = async (column: Locator) =>
  (await column.locator("article > button").allTextContents()).filter((t) => t.includes(String(stamp)));

async function addCard(column: Locator, title: string) {
  await column.getByRole("button", { name: "Adicionar um cartão" }).click();
  await column.getByRole("textbox").fill(title);
  await column.getByRole("button", { name: "Adicionar cartão" }).click();
  await expect(column.getByText(title)).toBeVisible();
}

// Arrasta com o mouse de verdade; `where` escolhe a metade do alvo onde soltar.
async function drag(page: Page, source: Locator, target: Locator, where: "top" | "bottom" = "top") {
  const s = (await source.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width / 2 + 12, s.y + s.height / 2 + 12, { steps: 3 });
  await page.mouse.move(t.x + t.width / 2, where === "top" ? t.y + 4 : t.y + t.height - 4, { steps: 15 });
  await page.mouse.up();
}

// Clica no canto do card (fora do título) e apaga pelo modal, passando pela confirmação.
async function removeCard(page: Page, title: string) {
  // role="button" só existe no card real; a cópia do arraste (overlay) some depois da animação de soltar
  await page.locator('article[role="button"]', { hasText: title }).click({ position: { x: 4, y: 4 } });
  await expect(page.getByRole("heading", { name: "Editar Tarefa" })).toBeVisible();
  await page.getByRole("button", { name: "Apagar Tarefa" }).click();
  await expect(page.getByText("Apagar tarefa?")).toBeVisible();
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByRole("heading", { name: "Editar Tarefa" })).toBeHidden();
  await expect(page.locator('article[role="button"]', { hasText: title })).toHaveCount(0);
}

test("reordena cards na mesma lista e apaga com confirmação", async ({ page }) => {
  await openKanban(page);
  const column = list(page, "Lista");
  const [a, b] = [`Ordem A ${stamp}`, `Ordem B ${stamp}`];
  await addCard(column, a);
  await addCard(column, b);
  expect(await titles(column)).toEqual([a, b]);

  await drag(page, column.locator("article", { hasText: b }), column.locator("article", { hasText: a }));
  await expect.poll(() => titles(column)).toEqual([b, a]);
  await page.reload();
  await expect.poll(() => titles(column)).toEqual([b, a]);

  await removeCard(page, a);
  await removeCard(page, b);
});

test("move card para o meio de outra lista e a ordem persiste", async ({ page }) => {
  await openKanban(page);
  await page.getByRole("button", { name: "Adicionar outra lista" }).click();
  await page.getByPlaceholder("Insira o título da lista...").fill(`Destino ${stamp}`);
  await page.getByRole("button", { name: "Adicionar lista" }).click();

  const from = list(page, "Lista");
  const to = list(page, `Destino ${stamp}`);
  const [x, p, q] = [`Mover X ${stamp}`, `Mover P ${stamp}`, `Mover Q ${stamp}`];
  await addCard(from, x);
  await addCard(to, p);
  await addCard(to, q);

  // solta na metade de cima de Q: X deve ficar entre P e Q
  await drag(page, from.locator("article", { hasText: x }), to.locator("article", { hasText: q }), "top");
  await expect.poll(() => titles(to)).toEqual([p, x, q]);
  expect(await titles(from)).toEqual([]);

  await page.reload();
  await expect.poll(() => titles(to)).toEqual([p, x, q]);

  // e de volta para o fim da lista de origem (lista vazia)
  await drag(page, to.locator("article", { hasText: x }), from.getByRole("heading", { name: "Lista", exact: true }));
  await expect.poll(() => titles(from)).toEqual([x]);
  await expect.poll(() => titles(to)).toEqual([p, q]);

  for (const title of [x, p, q]) await removeCard(page, title);
});
