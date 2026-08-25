import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";

const runId = randomUUID().slice(0, 8);
const password = `E2e-safe-${runId}!`;
const creatorEmail = `mobile-${runId}@example.com`;
const destination = `Porto Mobile ${runId}`;

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

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    // A few CSS px of slack absorbs scrollbar-width rounding differences
    // across browsers without hiding a real overflow bug.
    return document.documentElement.scrollWidth - viewportWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

test.beforeAll(async () => {
  const { data, error } = await admin.auth.admin.createUser({
    email: creatorEmail,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Viajante Mobile" },
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

test("primary trip sections are navigable on a phone-sized viewport without horizontal scrolling", async ({
  page,
}) => {
  await test.step("sign in and land on the dashboard", async () => {
    await page.goto("/auth/sign-in");
    await page.getByLabel("E-mail").fill(creatorEmail);
    await page.getByLabel("Senha").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await assertNoHorizontalOverflow(page);
  });

  await test.step("create a trip from the dashboard", async () => {
    await page.getByLabel("Destino").fill(destination);
    await page.getByLabel("Data de início").fill("2027-06-10");
    await page.getByLabel(/Data de término/).fill("2027-06-17");
    await page.getByRole("button", { name: "Criar viagem" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
  });

  await test.step("every primary section is reachable without the page scrolling sideways", async () => {
    await assertNoHorizontalOverflow(page);

    for (const tabName of ["Visão geral", "Itinerário", "Despesas", "Preparação", "Organizador"]) {
      const tab = page.getByRole("tab", { name: tabName });
      await tab.scrollIntoViewIfNeeded();
      await expect(tab).toBeVisible();
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await assertNoHorizontalOverflow(page);
    }
  });
});
