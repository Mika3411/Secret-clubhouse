import { test, expect } from "./fixtures.js";
import { e2eUsers, queryE2eDatabase } from "./database.js";
import { loginChild, loginParent, openPublicEntry } from "./helpers.js";

test("un parent et un enfant se connectent avec leurs identifiants privés", async ({ browser }) => {
  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  await loginParent(parentPage);
  await expect(parentPage.getByRole("heading", { name: "Bonjour, Camille" })).toBeVisible();

  const childContext = await browser.newContext();
  const childPage = await childContext.newPage();
  await loginChild(childPage, e2eUsers.alice);
  await expect(childPage.getByRole("heading", { name: "Salut, Alice !" })).toBeVisible();
  await expect(childPage.getByRole("navigation", { name: "Navigation principale" })).toBeVisible();

  await parentContext.close();
  await childContext.close();
});

test("l’inscription parent enregistre les preuves légales versionnées", async ({ page }) => {
  await openPublicEntry(page);
  await page.getByRole("tab", { name: "Inscription" }).click();
  await page.getByLabel("Prénom du parent").fill("Alex");
  await page.getByLabel("Adresse e-mail").fill("nouveau.parent@e2e.test");
  await page.getByLabel("Mot de passe", { exact: true }).fill("NouveauParent!42");

  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("alert")).toContainText("les deux confirmations demandées");

  await page.getByLabel(/J’accepte les conditions d’utilisation/).check();
  await page.getByLabel(/Je confirme être le parent/).check();
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Créer un compte enfant" })).toBeVisible();

  const result = await queryE2eDatabase(
    `select event_type,legal_basis,document_version,evidence->>'channel' as channel
     from legal_events
     where subject_account_id=(
       select id from accounts where email='nouveau.parent@e2e.test'
     )
     order by event_type`,
  );
  expect(result.rows).toEqual([
    {
      event_type: "contract_accepted",
      legal_basis: "contract",
      document_version: "2026-07-23",
      channel: "registration_form",
    },
    {
      event_type: "parental_authority_declared",
      legal_basis: "legitimate_interest",
      document_version: "2026-07-23",
      channel: "registration_form",
    },
    {
      event_type: "privacy_notice_provided",
      legal_basis: "legal_obligation",
      document_version: "2026-07-25-v3",
      channel: "registration_form",
    },
  ]);
});

test("un parent crée puis sélectionne un profil enfant", async ({ page }) => {
  await loginParent(page);
  await page.getByRole("button", { name: "Gestion" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();

  const dialog = page.getByRole("form", { name: "Créer un compte enfant" });
  await dialog.getByLabel("Prénom").fill("Zoé");
  await dialog.getByLabel("Âge").selectOption("7");
  await dialog.getByLabel("Pseudo privé de connexion").fill("zoe.club");
  await dialog.locator('input[type="password"]').fill("ClubhouseKid!42");
  await dialog.getByRole("button", { name: "Créer le compte" }).click();

  const zoeProfile = page.getByRole("button", { name: /Zoé 7 ans/ });
  await expect(zoeProfile).toBeVisible();
  await expect(zoeProfile).toHaveAttribute("aria-pressed", "true");

  const aliceProfile = page.getByRole("button", { name: /Alice 9 ans/ });
  await aliceProfile.click();
  await expect(aliceProfile).toHaveAttribute("aria-pressed", "true");
  await expect(zoeProfile).toHaveAttribute("aria-pressed", "false");
});

test("les erreurs de connexion enfant sont annoncées et reliées aux champs invalides", async ({ page }) => {
  await openPublicEntry(page);
  await page.getByRole("tab", { name: "Enfant" }).click();
  const username = page.getByLabel("Ton pseudo privé");
  const password = page.getByLabel("Mot de passe", { exact: true });
  await username.fill("x");
  await page.getByRole("button", { name: "Entrer dans mon espace" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toBeVisible();
  await expect(alert).toHaveAttribute("id", "auth-error");
  await expect(username).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(username).toHaveAttribute("aria-describedby", /(?:^|\s)auth-error(?:\s|$)/);
  await expect(password).toHaveAttribute("aria-describedby", "auth-error");
  await expect(username).toBeFocused();
});
