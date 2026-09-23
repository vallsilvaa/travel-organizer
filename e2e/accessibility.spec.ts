import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";

const runId = randomUUID().slice(0, 8);
const password = `E2e-safe-${runId}!`;
const creatorEmail = `a11y-${runId}@example.com`;
const tripTitle = `Viagem A11y ${runId}`;
const destination = `Praga A11y ${runId}`;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "E2E tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let creator: User | null = null;

async function assertNoViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const summary = results.violations
    .map((violation) => `${violation.id} (${violation.impact}): ${violation.nodes.length} node(s)`)
    .join("\n");
  expect(results.violations, `Accessibility violations on ${label}:\n${summary}`).toEqual([]);
}

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: creatorEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Auditor A11y" },
  });
  if (error) {
    throw error;
  }
  creator = data.user;
});

test.afterAll(async () => {
  if (!creator) {
    return;
  }
  await admin.from("trips").delete().eq("created_by", creator.id);
  await admin.auth.admin.deleteUser(creator.id);
});

test.describe("automated accessibility checks (WCAG 2 A/AA)", () => {
  test("public pages", async ({ page }) => {
    await page.goto("/");
    await assertNoViolations(page, "home");

    await page.goto("/auth/sign-in");
    await assertNoViolations(page, "sign-in");

    await page.goto("/auth/sign-up");
    await assertNoViolations(page, "sign-up");

    await page.goto("/auth/forgot-password");
    await assertNoViolations(page, "forgot-password");
  });

  test("dashboard and a trip page", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await page.getByLabel("E-mail").fill(creatorEmail);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await assertNoViolations(page, "dashboard");

    await page.getByRole("link", { name: /viagens/i }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await assertNoViolations(page, "trips");
    await page.getByRole("button", { name: "Nova viagem" }).click();

    await page.getByLabel("Título").fill(tripTitle);
    await page.getByLabel(/Destino 1/).fill(destination);
    await page.getByLabel("Data de início").fill("2027-07-01");
    await page.getByLabel(/Data de término/).fill("2027-07-08");
    await page.getByRole("button", { name: "Criar viagem" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await assertNoViolations(page, "trip page (overview tab)");

    await page.getByRole("tab", { name: "Roteiro" }).click();
    await assertNoViolations(page, "trip page (Roteiro tab, empty)");

    // R12 (#239): the rewritten Roteiro flow (R01-R11) needs its own
    // modals + calendar covered, not just the tab's static empty state.
    const itineraryItemA = `A11y Roteiro A ${runId}`;
    const itineraryItemB = `A11y Roteiro B ${runId}`;

    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    await assertNoViolations(page, "itinerary new-item modal");
    let form = page.getByRole("dialog");
    await form.getByLabel("Título").fill(itineraryItemA);
    await form.getByLabel("Data").fill("2027-07-02");
    await form.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("heading", { name: itineraryItemA })).toBeVisible();

    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    form = page.getByRole("dialog");
    await form.getByLabel("Título").fill(itineraryItemB);
    await form.getByLabel("Data").fill("2027-07-03");
    await form.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("heading", { name: itineraryItemB })).toBeVisible();

    await assertNoViolations(page, "trip page (Roteiro tab, with items + calendar)");

    await page.getByRole("button", { name: "Adicionar do catálogo" }).click();
    await assertNoViolations(page, "itinerary catalog modal");
    const catalogDialog = page.getByRole("dialog");
    await catalogDialog.getByRole("checkbox", { name: `Selecionar ${itineraryItemA}` }).check();
    await catalogDialog.getByRole("checkbox", { name: `Selecionar ${itineraryItemB}` }).check();
    await catalogDialog.getByRole("button", { name: "Continuar" }).click();
    await assertNoViolations(page, "itinerary multi-select date modal");
    await page.getByRole("dialog").getByRole("button", { name: "Cancelar" }).click();

    for (const tabName of ["Despesas", "Preparação", "Colaboradores"]) {
      await page.getByRole("tab", { name: tabName }).click();
      await assertNoViolations(page, `trip page (${tabName} tab)`);
    }

    // Still signed in: an authorized visitor hitting a trip that doesn't
    // exist (or that they no longer have access to) is a realistic path,
    // unlike the generic 404 below.
    await page.goto("/trips/00000000-0000-4000-8000-000000000000");
    await assertNoViolations(page, "trip not-found page");
  });

  test("generic 404", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");
    await assertNoViolations(page, "404 page");
  });
});
