import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";

const runId = randomUUID().slice(0, 8);
const password = `E2e-safe-${runId}!`;
const creatorEmail = `creator-${runId}@example.com`;
const organizerEmail = `organizer-${runId}@example.com`;
const tripTitle = `Viagem E2E ${runId}`;
const destination = `Lisboa E2E ${runId}`;
const itineraryTitle = `Museu E2E ${runId}`;
const taskTitle = `Seguro E2E ${runId}`;
const expenseDescription = `Jantar E2E ${runId}`;
const commentBody = `Reserva confirmada E2E ${runId}`;

// R12 (#239): a dedicated trip/user for the Roteiro v2 rewrite (R01-R11)
// instead of folding this into the journey above - it needs its own city
// destination (selected from the bundled dataset, not free text) so the R09
// whole-trip filter has something real to filter by.
const itineraryEmail = `itinerary-${runId}@example.com`;
const itineraryTripTitle = `Viagem Roteiro E2E ${runId}`;
const itemOneTitle = `Museu Roteiro E2E ${runId}`;
const itemTwoTitle = `Segundo Museu Roteiro E2E ${runId}`;
const draftTitle = `Rascunho Roteiro E2E ${runId}`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "E2E tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

let organizer: User | null = null;

async function signIn(page: Page, email: string) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function signOut(page: Page) {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);
}

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: organizerEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Organizador E2E" },
  });

  if (error) {
    throw error;
  }

  organizer = data.user;
});

test.afterAll(async () => {
  const { data } = await admin.auth.admin.listUsers();
  const testUsers = data.users.filter(
    (user) =>
      user.email === creatorEmail ||
      user.email === organizerEmail ||
      user.email === itineraryEmail,
  );

  for (const user of testUsers) {
    await admin.from("trips").delete().eq("created_by", user.id);
    await admin.auth.admin.deleteUser(user.id);
  }
});

test("traveler completes the critical collaborative planning journey", async ({
  page,
}) => {
  await test.step("sign up, sign out, and sign back in", async () => {
    await page.goto("/auth/sign-up");
    await page.getByLabel("Nome").fill("Criador E2E");
    await page.getByLabel("E-mail").fill(creatorEmail);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await signOut(page);
    await signIn(page, creatorEmail);
  });

  await test.step("create and open a trip", async () => {
    await page.getByRole("link", { name: /viagens/i }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await page.getByRole("button", { name: "Nova viagem" }).click();

    await page.getByLabel("Título").fill(tripTitle);
    await page.getByLabel(/Destino 1/).fill(destination);
    await page.getByLabel("Data de início").fill("2027-05-10");
    await page.getByLabel(/Data de término/).fill("2027-05-17");
    await page.getByRole("button", { name: "Criar viagem" }).click();

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: tripTitle })).toBeVisible();
  });

  await test.step("create an itinerary item and comment", async () => {
    await page.getByRole("tab", { name: "Roteiro" }).click();
    // #231/R04: "Adicionar item ao roteiro" was an inline <details> panel;
    // it's now the "Novo item de roteiro" modal (Dialog in both browser and
    // PWA-standalone mode).
    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    const form = page.getByRole("dialog");

    await form.getByLabel("Data").fill("2027-05-11");
    await form.getByLabel("Horário", { exact: true }).fill("10:30");
    await form.getByLabel("Título").fill(itineraryTitle);
    await form.getByLabel("Endereço").fill("Centro");
    await form.getByRole("button", { name: "Salvar", exact: true }).click();

    const item = page.locator("li").filter({
      has: page.getByRole("heading", { name: itineraryTitle }),
    });
    await expect(item).toBeVisible();
    await item.getByPlaceholder("Adicione um contexto ou uma decisão...").fill(commentBody);
    await item.getByRole("button", { name: "Comentar" }).click();
    await expect(item.locator("p").filter({ hasText: commentBody })).toBeVisible();
  });

  await test.step("create an expense", async () => {
    await page.getByRole("tab", { name: "Despesas" }).click();
    const form = page.locator("details").filter({ hasText: "Adicionar despesa" });

    await form.getByLabel("Descrição").fill(expenseDescription);
    await form.getByLabel("Valor", { exact: true }).fill("125.50");
    await form.getByLabel("Moeda").fill("BRL");
    await form.getByLabel("Data").fill("2027-05-11");
    await form.getByRole("combobox", { name: "Pagador" }).click();
    await page.getByRole("option", { name: /Criador E2E/ }).click();
    await form.getByRole("button", { name: "Adicionar despesa" }).click();

    await page.getByRole("tab", { name: "Despesas" }).click();
    await expect(page.getByRole("heading", { name: expenseDescription })).toBeVisible();
  });

  await test.step("create and complete a preparation task", async () => {
    await page.getByRole("tab", { name: "Preparação" }).click();
    await page.getByRole("button", { name: "Criar Tarefa" }).click();

    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("O quê").fill(taskTitle);
    await dialog.getByRole("combobox", { name: "Classificação" }).click();
    await page.getByRole("option", { name: "Obrigatório" }).click();
    await dialog.getByLabel("Local").fill("Brasil");
    await dialog.getByRole("combobox", { name: "Dias antes da partida" }).click();
    await page.getByRole("option", { name: "30 dias antes" }).click();
    await dialog.getByRole("button", { name: "Adicionar modelo" }).click();

    await page.getByRole("tab", { name: "Preparação" }).click();
    const taskItem = page.locator("li").filter({
      has: page.getByRole("heading", { name: taskTitle }),
    });
    await expect(taskItem).toBeVisible();
    await taskItem.getByRole("button", { name: "Concluir" }).click();

    // Completing a governed task offers to convert it into a reservation or
    // itinerary item first - the task itself is only marked complete once
    // that dialog is dismissed (Pular here, since this flow doesn't need
    // either conversion).
    await page.getByRole("button", { name: "Pular" }).click();

    // Completing a task removes it from the default "Em aberto" view (#171) -
    // switch to "Todos os status" to confirm it now shows as done.
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Todos os status" }).click();
    await page.getByRole("button", { name: "Aplicar filtros" }).click();

    const completedTaskItem = page.locator("li").filter({
      has: page.getByRole("heading", { name: taskTitle }),
    });
    await expect(completedTaskItem.getByText("Concluída")).toBeVisible();
  });

  await test.step("invite and accept an organizer", async () => {
    await page.getByRole("tab", { name: "Colaboradores" }).click();
    await page.getByLabel("E-mail do convidado").fill(organizerEmail);
    await page.getByRole("button", { name: "Enviar convite" }).click();
    await page.getByRole("tab", { name: "Colaboradores" }).click();
    await expect(page.getByText(organizerEmail, { exact: true })).toBeVisible();

    await signOut(page);
    await signIn(page, organizerEmail);
    await page.getByRole("link", { name: /viagens/i }).click();
    await expect(page).toHaveURL(/\/trips$/);
    const invitation = page.locator("li").filter({ hasText: destination });
    await invitation.getByRole("button", { name: "Aceitar" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: tripTitle })).toBeVisible();
  });

  await signOut(page);
  expect(organizer?.email).toBe(organizerEmail);
});

test("traveler exercises the Roteiro v2 rewrite end to end", async ({ page }) => {
  await test.step("sign up and create a trip with a real city destination", async () => {
    await page.goto("/auth/sign-up");
    await page.getByLabel("Nome").fill("Roteiro E2E");
    await page.getByLabel("E-mail").fill(itineraryEmail);
    await page.getByLabel("Senha", { exact: true }).fill(password);
    await page.getByLabel("Confirmar senha").fill(password);
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole("link", { name: /viagens/i }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await page.getByRole("button", { name: "Nova viagem" }).click();

    await page.getByLabel("Título").fill(itineraryTripTitle);
    // Typing without picking a suggestion falls back to a country-only
    // destination (destination-autocomplete.tsx) - picking the real "Lisbon,
    // Portugal" row instead gives the trip a city-granularity destination,
    // which is what makes it show up in the R09 city filter on its own.
    await page.getByLabel(/Destino 1/).fill("Lisb");
    await page.getByRole("button", { name: "Lisbon, Portugal", exact: true }).click();
    await page.getByLabel("Data de início").fill("2027-08-01");
    await page.getByLabel(/Data de término/).fill("2027-08-10");
    await page.getByRole("button", { name: "Criar viagem" }).click();

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await page.getByRole("tab", { name: "Roteiro" }).click();
  });

  await test.step("create an item via the modal: activity + title combined, with an end time", async () => {
    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    const form = page.getByRole("dialog");

    await form.getByLabel("Atividade").fill("Visitar");
    await form.getByLabel("Título").fill(itemOneTitle);
    await form.getByLabel("Data").fill("2027-08-02");
    await form.getByLabel("Horário", { exact: true }).fill("09:00");
    await form.getByLabel("Horário de término").fill("11:00");
    await form.getByLabel("Endereço").fill("Rua Um");
    await form.getByLabel("Local").fill("Lisb");
    await form.getByRole("button", { name: "Lisbon, Portugal", exact: true }).click();
    await form.getByRole("button", { name: "Salvar", exact: true }).click();

    const item = page.locator("li").filter({
      has: page.getByRole("heading", { name: `Visitar ${itemOneTitle}` }),
    });
    await expect(item).toBeVisible();
    await expect(item.getByText("09:00–11:00")).toBeVisible();
  });

  await test.step("create a second item (reused/filtered on later)", async () => {
    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    const form = page.getByRole("dialog");

    await form.getByLabel("Título").fill(itemTwoTitle);
    await form.getByLabel("Data").fill("2027-08-04");
    await form.getByLabel("Endereço").fill("Rua Dois");
    await form.getByLabel("Local").fill("Lisb");
    await form.getByRole("button", { name: "Lisbon, Portugal", exact: true }).click();
    await form.getByRole("button", { name: "Salvar", exact: true }).click();

    // #231/R04: a successful "full" save switches the active day-tab to
    // wherever the new item landed, so it's visible without clicking Dia 4.
    await expect(page.getByRole("heading", { name: itemTwoTitle })).toBeVisible();
  });

  await test.step("draft persists when the modal is closed by clicking outside, and restores on reopen", async () => {
    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    let form = page.getByRole("dialog");
    await form.getByLabel("Título").fill(draftTitle);

    // The overlay covers the whole viewport (dialog.tsx) - clicking a corner
    // of it, away from the centered dialog content, is a real "click outside".
    await page.locator('[data-slot="dialog-overlay"]').click({ position: { x: 5, y: 5 } });
    await expect(form).toBeHidden();

    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    form = page.getByRole("dialog");
    await expect(form.getByText("Rascunho restaurado")).toBeVisible();
    await expect(form.getByLabel("Título")).toHaveValue(draftTitle);

    await form.getByRole("button", { name: "Cancelar" }).click();
    await expect(form).toBeHidden();
  });

  await test.step("clicking a day in the calendar activates that day's tab", async () => {
    const targetDate = "2027-08-04";
    // Mirrors calendar.tsx's own fullDateFormatter (pt -> pt-BR, UTC) so this
    // doesn't hardcode a locale-formatted string that could drift.
    const label = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${targetDate}T00:00:00Z`));

    await page.getByRole("tab", { name: "Dia 2" }).click();
    await expect(page.getByRole("tab", { name: "Dia 2" })).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: label }).click();
    await expect(page.getByRole("tab", { name: "Dia 4" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: itemTwoTitle })).toBeVisible();
  });

  await test.step("add an existing item to the roteiro from the catalog (single select)", async () => {
    await page.getByRole("button", { name: "Adicionar do catálogo" }).click();
    const searchDialog = page.getByRole("dialog");
    await searchDialog.getByRole("button", { name: itemTwoTitle }).click();

    const form = page.getByRole("dialog");
    await expect(form.getByLabel("Título")).toHaveValue(itemTwoTitle);
    await form.getByLabel("Data").fill("2027-08-05");
    await form.getByRole("button", { name: "Salvar", exact: true }).click();

    await expect(page.getByRole("tab", { name: "Dia 5" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: itemTwoTitle })).toBeVisible();
  });

  await test.step("add multiple existing items at once, each with its own date - flagged for review", async () => {
    await page.getByRole("button", { name: "Adicionar do catálogo" }).click();
    const searchDialog = page.getByRole("dialog");

    await searchDialog.getByRole("checkbox", { name: `Selecionar Visitar ${itemOneTitle}` }).check();
    await searchDialog.getByRole("checkbox", { name: `Selecionar ${itemTwoTitle}` }).check();
    await searchDialog.getByRole("button", { name: "Continuar" }).click();

    const dateForm = page.getByRole("dialog");
    await dateForm.getByLabel(`Data de Visitar ${itemOneTitle}`).fill("2027-08-06");
    await dateForm.getByLabel(`Data de ${itemTwoTitle}`).fill("2027-08-07");
    await dateForm.getByRole("button", { name: "Adicionar 2 itens" }).click();
    await expect(dateForm).toBeHidden();

    // D8 (#229/#233): a batch-added item is flagged needs_review until its
    // next edit - the "Revisar" badge/style is item-card.tsx's own rendering
    // of that flag, not something this test sets directly.
    await page.getByRole("tab", { name: "Dia 6" }).click();
    const reviewItem = page.locator("li").filter({
      has: page.getByRole("heading", { name: `Visitar ${itemOneTitle}` }),
    });
    await expect(reviewItem).toBeVisible();
    await expect(reviewItem.getByText("Revisar")).toBeVisible();
  });

  await test.step("the whole-trip filter flattens matching items across days into one list", async () => {
    await page.getByRole("combobox", { name: "Cidade" }).click();
    await page.getByRole("option", { name: "Lisbon", exact: true }).click();

    await expect(page.getByRole("heading", { name: /\(Dia 2\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /\(Dia 4\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /\(Dia 6\)/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /\(Dia 7\)/ })).toBeVisible();

    await page.getByRole("link", { name: "Limpar filtros" }).click();
  });

  await test.step("export the roteiro as .ics and, with confirmation, as a PDF", async () => {
    await page.getByRole("button", { name: "Exportar" }).click();
    const [icsDownload, icsResponse] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((response) => response.url().includes("/itinerary.ics")),
      page.getByRole("menuitem", { name: "Calendário (.ics)" }).click(),
    ]);
    expect(icsResponse.status()).toBe(200);
    expect(icsDownload.suggestedFilename()).toMatch(/\.ics$/);

    await page.getByRole("button", { name: "Exportar" }).click();
    await page.getByRole("menuitem", { name: "PDF" }).click();

    // pdf-filename.ts: an ASCII-only trip title makes the legacy `filename`
    // and RFC 5987 `filename*` identical, so there's no ambiguity over which
    // one the browser's download manager will actually use.
    const expectedPdfFileName = `ROTEIRO-${itineraryTripTitle}.pdf`;
    const confirmDialog = page.getByRole("dialog");
    await expect(confirmDialog.getByText(`Baixar ${expectedPdfFileName}?`)).toBeVisible();

    const [pdfDownload, pdfResponse] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((response) => response.url().includes("/itinerary.pdf")),
      confirmDialog.locator("a[download]").click(),
    ]);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()["content-type"]).toBe("application/pdf");
    expect(pdfDownload.suggestedFilename()).toBe(expectedPdfFileName);
  });
});
