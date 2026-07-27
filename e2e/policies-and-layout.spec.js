import { test, expect } from "./fixtures.js";
import { e2eUsers } from "./database.js";
import {
  expectNoHorizontalOverflow,
  loginChild,
  loginParent,
} from "./helpers.js";

test("les horaires bloqués et un profil en pause restent compréhensibles", async ({ browser }) => {
  const quietContext = await browser.newContext();
  const quietPage = await quietContext.newPage();
  await loginChild(quietPage, e2eUsers.quietChild);
  await quietPage.locator("button.conversation-row").filter({ hasText: "Ève" }).click();
  await expect(quietPage.getByText("Les messages sont en pause pour le moment.")).toBeVisible();
  await expect(quietPage.getByPlaceholder(/Disponible à/)).toBeDisabled();
  await expect(quietPage.getByRole("button", { name: "Envoyer le message" })).toBeDisabled();

  const pausedContext = await browser.newContext();
  const pausedPage = await pausedContext.newPage();
  await loginChild(pausedPage, e2eUsers.pausedChild);
  await expect(pausedPage.getByRole("heading", { name: "À bientôt, Milo" })).toBeVisible();
  await expect(pausedPage.getByText("Un parent a temporairement mis ce profil en pause.")).toBeVisible();

  await quietContext.close();
  await pausedContext.close();
});

test("les politiques parent et enfant sont publiques avant inscription", async ({ page }) => {
  await page.goto("/confidentialite");
  const parentPolicy = page.getByRole("dialog", { name: "Politique de confidentialité" });
  await expect(parentPolicy).toBeVisible();
  await expect(parentPolicy.getByText(/Version du 27 juillet 2026 — version 8/)).toBeVisible();
  await expect(parentPolicy.getByRole("heading", { name: "Pourquoi et sur quel fondement ?" })).toBeVisible();

  await page.goto("/confidentialite-enfants");
  const childPolicy = page.getByRole("dialog", { name: "Tes données, simplement" });
  await expect(childPolicy).toBeVisible();
  await expect(childPolicy.getByRole("heading", { name: "Ta vie privée compte vraiment" })).toBeVisible();
  await expect(childPolicy.getByRole("button", { name: /Pour les enfants/ })).toHaveAttribute("aria-pressed", "true");
});

test("la politique empile ses tableaux uniquement sur téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/confidentialite");
  const policy = page.getByRole("dialog", { name: "Politique de confidentialité" });
  await expect(policy).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const firstRow = policy.locator("table tbody tr").first();
  await expect(firstRow).toHaveCSS("display", "grid");
  await expect(firstRow.locator("td").first()).toHaveCSS("display", "grid");

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(firstRow).toHaveCSS("display", "table-row");
  await expect(firstRow.locator("td").first()).toHaveCSS("display", "table-cell");
  await expectNoHorizontalOverflow(page);
});

test("le parent peut voir et révoquer toutes ses autres sessions", async ({ page, browser }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginParent(page);

  const secondContext = await browser.newContext();
  const secondPage = await secondContext.newPage();
  await loginParent(secondPage);

  const navigation = page.getByRole("navigation", { name: "Navigation du mode parent" });
  await navigation.getByRole("button", { name: "Gestion" }).click();
  await page.getByRole("button", { name: /Appareils connectés/ }).click();
  const dialog = page.getByRole("dialog", { name: "Appareils connectés" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Appareil actuel")).toHaveCount(1);
  await expect(dialog.locator(".parent-session-card")).toHaveCount(2);

  await dialog.getByRole("button", { name: "Déconnecter tous les autres appareils" }).click();
  await expect(dialog.getByText("Déconnecter tous les autres appareils ?")).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmer la déconnexion" }).click();
  await expect(dialog.locator(".parent-session-card")).toHaveCount(1);

  await secondPage.reload();
  await expect(secondPage.getByRole("heading", { name: "Des amis choisis. Des parents rassurés." })).toBeVisible();
  await secondContext.close();
});

test("la navigation parent fonctionne sur téléphone et tablette", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loginParent(page);
  const navigation = page.getByRole("navigation", { name: "Navigation du mode parent" });
  await expect(navigation).toBeVisible();

  await navigation.getByRole("button", { name: "Gestion" }).click();
  await expect(navigation.getByRole("button", { name: "Gestion" })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("button", { name: "Conversations" }).click();
  await expect(page.getByRole("heading", { name: "Messagerie parentale" })).toBeVisible();
  await page.getByRole("button", { name: "Ouvrir la conversation avec Alice" }).click();
  await expect(page.getByRole("region", { name: "Conversation parentale avec Alice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retour aux conversations parentales" })).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });
  const master = page.getByRole("complementary", { name: "Liste des conversations parentales" });
  const detail = page.getByRole("region", { name: "Conversation parentale avec Alice" });
  await expect(master).toBeVisible();
  await expect(detail).toBeVisible();
  const [masterBox, detailBox] = await Promise.all([master.boundingBox(), detail.boundingBox()]);
  expect(masterBox).not.toBeNull();
  expect(detailBox).not.toBeNull();
  expect(masterBox.x + masterBox.width).toBeLessThanOrEqual(detailBox.x + 1);
});

test("les écrans principaux ne débordent pas horizontalement à 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Des amis choisis. Des parents rassurés." })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await loginParent(page);
  await expectNoHorizontalOverflow(page);
  const navigation = page.getByRole("navigation", { name: "Navigation du mode parent" });
  await navigation.getByRole("button", { name: "Gestion" }).click();
  await expect(page.getByRole("heading", { name: "Gestion de la famille" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await navigation.getByRole("button", { name: "Conversations" }).click();
  await expect(page.getByRole("heading", { name: "Messagerie parentale" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
