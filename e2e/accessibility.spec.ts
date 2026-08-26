import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";

const runId = randomUUID().slice(0, 8);
const password = `E2e-safe-${runId}!`;
const creatorEmail = `a11y-${runId}@example.com`;
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

    await page.getByLabel("Destino").fill(destination);
    await page.getByLabel("Data de início").fill("2027-07-01");
    await page.getByLabel(/Data de término/).fill("2027-07-08");
    await page.getByRole("button", { name: "Criar viagem" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
    await assertNoViolations(page, "trip page (overview tab)");

    for (const tabName of ["Itinerário", "Despesas", "Preparação", "Colaboradores"]) {
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
