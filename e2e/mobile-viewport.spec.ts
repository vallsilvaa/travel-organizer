import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";
import { createClient, type User } from "@supabase/supabase-js";

const runId = randomUUID().slice(0, 8);
const password = `E2e-safe-${runId}!`;
const creatorEmail = `mobile-${runId}@example.com`;
const tripTitle = `Viagem Mobile ${runId}`;
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

  await test.step("create a trip from the trips page", async () => {
    await page.getByRole("link", { name: /viagens/i }).click();
    await expect(page).toHaveURL(/\/trips$/);
    await assertNoHorizontalOverflow(page);
    await page.getByRole("button", { name: "Nova viagem" }).click();

    await page.getByLabel("Título").fill(tripTitle);
    await page.getByLabel(/Destino 1/).fill(destination);
    await page.getByLabel("Data de início").fill("2027-06-10");
    await page.getByLabel(/Data de término/).fill("2027-06-17");
    await page.getByRole("button", { name: "Criar viagem" }).click();
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);
  });

  await test.step("every primary section is reachable without the page scrolling sideways", async () => {
    await assertNoHorizontalOverflow(page);

    for (const tabName of ["Visão geral", "Roteiro", "Despesas", "Preparação", "Colaboradores"]) {
      const tab = page.getByRole("tab", { name: tabName });
      // The tab strip scrolls horizontally on narrow viewports (more tabs than
      // fit at once). Playwright's own pre-click auto-scroll re-runs on every
      // actionability retry and doesn't reliably settle within this nested
      // scroll container, repeatedly leaving the target clipped by its parent's
      // edge - so scroll it into view ourselves and dispatch the click directly
      // instead of letting `.click()` recompute (and re-break) the scroll position.
      await tab.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
      await expect(tab).toBeVisible();
      // "Visão geral" is the default/already-active tab on load - clicking
      // an already-selected tab isn't a real user action and isn't needed
      // to exercise it, so only click tabs that actually need switching to.
      if ((await tab.getAttribute("aria-selected")) !== "true") {
        await tab.dispatchEvent("click");
      }
      await expect(tab).toHaveAttribute("aria-selected", "true");
      await assertNoHorizontalOverflow(page);
    }
  });

  await test.step("the rewritten Roteiro modals fit a phone-sized viewport without horizontal scrolling", async () => {
    // dialog.tsx's `standalone:` bottom-sheet classes only kick in for a real
    // installed PWA (display-mode: standalone), which this browser-based test
    // can't emulate - what's actually checked here is the fallback every new
    // modal shares on a narrow viewport: the centered, width-capped Dialog.
    // Same horizontally-scrolling tab strip as the step above - plain
    // .click() leaves the tab clipped by its scroll container's edge.
    const roteiroTab = page.getByRole("tab", { name: "Roteiro" });
    await roteiroTab.evaluate((el) => el.scrollIntoView({ block: "nearest", inline: "center" }));
    await roteiroTab.dispatchEvent("click");
    await expect(roteiroTab).toHaveAttribute("aria-selected", "true");

    await page.getByRole("button", { name: "Novo item de roteiro" }).click();
    const newItemForm = page.getByRole("dialog");
    await expect(newItemForm).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await newItemForm.getByLabel("Título").fill(`Mobile Roteiro ${runId}`);
    await assertNoHorizontalOverflow(page);
    await newItemForm.getByRole("button", { name: "Cancelar" }).click();
    await expect(newItemForm).toBeHidden();

    await page.getByRole("button", { name: "Adicionar do catálogo" }).click();
    const catalogDialog = page.getByRole("dialog");
    await expect(catalogDialog).toBeVisible();
    await assertNoHorizontalOverflow(page);
    // Unlike the new-item modal, the catalog search dialog has no Cancelar -
    // only the built-in X (dialog.tsx's DialogClose) and Esc close it.
    await page.keyboard.press("Escape");
    await expect(catalogDialog).toBeHidden();
  });
});
