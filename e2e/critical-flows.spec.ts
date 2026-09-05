import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";

const runId = randomUUID().slice(0, 8);
const password = `E2e-safe-${runId}!`;
const creatorEmail = `creator-${runId}@example.com`;
const organizerEmail = `organizer-${runId}@example.com`;
const destination = `Lisboa E2E ${runId}`;
const itineraryTitle = `Museu E2E ${runId}`;
const taskTitle = `Seguro E2E ${runId}`;
const expenseDescription = `Jantar E2E ${runId}`;
const commentBody = `Reserva confirmada E2E ${runId}`;

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
    (user) => user.email === creatorEmail || user.email === organizerEmail,
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
    await page.getByLabel("Destino").fill(destination);
    await page.getByLabel("Data de início").fill("2027-05-10");
    await page.getByLabel(/Data de término/).fill("2027-05-17");
    await page.getByRole("button", { name: "Criar viagem" }).click();

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: destination })).toBeVisible();
  });

  await test.step("create an itinerary item and comment", async () => {
    await page.getByRole("tab", { name: "Roteiro" }).click();
    const form = page
      .locator("details")
      .filter({ hasText: "Adicionar item ao roteiro" });

    await form.getByLabel("Data").fill("2027-05-11");
    await form.getByLabel("Horário").fill("10:30");
    await form.getByLabel("Título").fill(itineraryTitle);
    await form.getByLabel("Local").fill("Centro");
    await form.getByRole("button", { name: "Adicionar ao roteiro" }).click();

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
    await dialog.getByLabel("Título").fill(taskTitle);
    await dialog.getByRole("combobox", { name: "Classificação" }).click();
    await page.getByRole("option", { name: "Obrigatório" }).click();
    await dialog.getByLabel("País").fill("Brasil");
    await dialog.getByRole("combobox", { name: "Dias antes da partida" }).click();
    await page.getByRole("option", { name: "30 dias antes" }).click();
    await dialog.getByRole("button", { name: "Adicionar modelo" }).click();

    await page.getByRole("tab", { name: "Preparação" }).click();
    const taskItem = page.locator("li").filter({
      has: page.getByRole("heading", { name: taskTitle }),
    });
    await expect(taskItem).toBeVisible();
    await taskItem.getByRole("button", { name: "Concluir" }).click();
    await expect(taskItem.getByText("Concluída")).toBeVisible();
  });

  await test.step("invite and accept an organizer", async () => {
    await page.getByRole("tab", { name: "Colaboradores" }).click();
    await page.getByLabel("E-mail do convidado").fill(organizerEmail);
    await page.getByRole("button", { name: "Enviar convite" }).click();
    await page.getByRole("tab", { name: "Colaboradores" }).click();
    await expect(page.getByText(organizerEmail, { exact: true })).toBeVisible();

    await signOut(page);
    await signIn(page, organizerEmail);
    const invitation = page.locator("li").filter({ hasText: destination });
    await invitation.getByRole("button", { name: "Aceitar" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: destination })).toBeVisible();
  });

  await signOut(page);
  expect(organizer?.email).toBe(organizerEmail);
});
