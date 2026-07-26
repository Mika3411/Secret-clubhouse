import { expect } from "@playwright/test";
import { e2eUsers } from "./database.js";

export async function openPublicEntry(page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Des amis choisis. Des parents rassurés." })).toBeVisible();
}

export async function loginParent(page, user = e2eUsers.parent) {
  await openPublicEntry(page);
  await page.getByLabel("Adresse e-mail").fill(user.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("navigation", { name: "Navigation du mode parent" })).toBeVisible();
}

export async function loginChild(page, user) {
  await openPublicEntry(page);
  await page.getByRole("tab", { name: "Enfant" }).click();
  await page.getByLabel("Ton pseudo privé").fill(user.username);
  await page.getByLabel("Mot de passe", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "Entrer dans mon espace" }).click();
}

export async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(overflow.document, `document.scrollWidth=${overflow.document}`).toBeLessThanOrEqual(overflow.viewport);
  expect(overflow.body, `body.scrollWidth=${overflow.body}`).toBeLessThanOrEqual(overflow.viewport);
}
