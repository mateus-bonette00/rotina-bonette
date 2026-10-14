import { expect, test, type Page } from "@playwright/test";

const pin = process.env.E2E_PIN ?? "0708";
const name = `Rotina e2e ${Date.now()}`;
const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

async function login(page: Page) {
  await page.goto("/login");
  for (const digit of pin) await page.getByTestId(`pin-key-${digit}`).click();
  await expect(page.getByRole("heading", { name: "Calendário" })).toBeVisible();
}

async function setDays(page: Page, wanted: string[]) {
  for (const label of dayLabels) {
    const button = page.getByTestId("routine-form").getByRole("button", { name: label, exact: true });
    const on = (await button.getAttribute("aria-pressed")) === "true";
    if (on !== wanted.includes(label)) await button.click();
  }
}

const occurrences = (page: Page) => page.locator(".fc-event.is-routine", { hasText: name });

test("modal longo rola e o botão de salvar fica alcançável", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  await login(page);
  await page.getByRole("button", { name: "Novo" }).click();
  const save = page.getByRole("button", { name: "Salvar bloco" });
  await save.scrollIntoViewIfNeeded();
  await expect(save).toBeInViewport();
  const dialogBox = (await page.locator("dialog[open]").boundingBox())!;
  expect(dialogBox.y + dialogBox.height).toBeLessThanOrEqual(600);
});

test("rotina quinzenal com horário por dia: pular, pausar e retomar sem mexer na série", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByRole("tab", { name: "Repetir" }).click();
  // O formulário é reiniciado logo após a troca de aba; só digita depois que o dia padrão aparece marcado.
  await expect(page.getByTestId("routine-form").locator('[aria-pressed="true"]')).toHaveCount(1);
  await page.getByPlaceholder("Ex: Academia, Inglês, Revisão do dia...").fill(name);
  await setDays(page, ["Qua", "Qui"]);
  await page.getByLabel("Início Qua").fill("14:00");
  await page.getByLabel("Duração Qua (min)").fill("180");
  await page.getByLabel("Início Qui").fill("09:00");
  await page.getByLabel("Duração Qui (min)").fill("120");
  await page.getByTestId("routine-form").locator("select").filter({ hasText: "quinzenal" }).selectOption("2");
  await expect(page.getByText("Contar a partir de")).toBeVisible();
  await page.getByRole("button", { name: "Salvar rotina" }).click();

  // A âncora é a semana atual, então a série aparece nela.
  await expect(occurrences(page).first()).toBeVisible();

  // Pular só um dia.
  await occurrences(page).first().click();
  await expect(page.getByTestId("occurrence-menu")).toBeVisible();
  await page.getByRole("button", { name: "Pular só este dia" }).click();
  await expect(page.locator(".fc-event.is-paused", { hasText: name }).first()).toBeVisible();

  // Fantasma é clicável e reativa.
  await page.locator(".fc-event.is-paused", { hasText: name }).first().click();
  await page.getByRole("button", { name: "Reativar este dia" }).click();
  await expect(page.locator(".fc-event.is-paused", { hasText: name })).toHaveCount(0);

  // Pausar até uma data de volta (3 semanas à frente) e retomar a série.
  const back = new Date(Date.now() + 21 * 86_400_000);
  const iso = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, "0")}-${String(back.getDate()).padStart(2, "0")}`;
  await occurrences(page).first().click();
  await page.getByLabel("Pausar até voltar em").fill(iso);
  await page.getByRole("button", { name: "Pausar até essa data" }).click();
  await expect(page.locator(".fc-event.is-paused", { hasText: name }).first()).toBeVisible();
  await page.locator(".fc-event.is-paused", { hasText: name }).first().click();
  await page.getByRole("button", { name: "Retomar a série agora" }).click();
  await expect(page.locator(".fc-event.is-paused", { hasText: name })).toHaveCount(0);

  // Limpa o que o teste criou.
  await occurrences(page).first().click();
  await page.getByRole("button", { name: "Editar a série" }).click();
  await page.getByRole("button", { name: "Apagar rotina" }).click();
  await expect(occurrences(page)).toHaveCount(0);
});
