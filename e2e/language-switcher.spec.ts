import { expect, test } from "@playwright/test";

// Cookie-based locale (no /pt or /en URL prefix - see issue #39), so this
// only needs a public, unauthenticated page to exercise end to end.
test("switches the UI language and persists it across a reload", async ({ page }) => {
  await page.goto("/auth/sign-in");
  await expect(page.getByRole("heading", { name: "Bem-vindo de volta" })).toBeVisible();

  await page.getByRole("button", { name: "Alternar idioma" }).click();
  await page.getByRole("menuitem", { name: "English" }).click();

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/sign-in$/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
