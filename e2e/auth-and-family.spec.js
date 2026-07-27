import { test, expect } from "./fixtures.js";
import { e2eUsers, queryE2eDatabase } from "./database.js";
import { expectNoHorizontalOverflow, loginChild, loginParent, openPublicEntry } from "./helpers.js";
import { legalDocumentVersions } from "../src/legal-versions.js";

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
  await expect(page.getByText("Juste après, vous ajouterez le profil de votre premier enfant.")).toBeVisible();

  await page.getByRole("button", { name: "Créer mon compte et ajouter mon enfant" }).click();
  await expect(page.getByRole("alert")).toContainText("les deux confirmations demandées");

  await page.getByLabel(/J’accepte les conditions d’utilisation/).check();
  await page.getByLabel(/Je confirme être le parent/).check();
  await page.getByRole("button", { name: "Créer mon compte et ajouter mon enfant" }).click();
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
      document_version: legalDocumentVersions.privacy.id,
      channel: "registration_form",
    },
  ]);
});

test("un grand-parent rejoint seulement les enfants et communications choisis", async ({ browser }) => {
  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  await loginParent(parentPage);
  await parentPage.getByRole("button", { name: "Gestion" }).click();
  await parentPage.getByRole("button", { name: /Adultes de la famille/ }).click();

  const adultsDialog = parentPage.getByRole("dialog", { name: "Adultes de la famille" });
  await expect(adultsDialog).toBeVisible();
  await expect(adultsDialog.getByRole("tab", { name: "Proche autorisé" })).toHaveAttribute("aria-selected", "true");
  await adultsDialog.getByLabel("Adresse e-mail").fill("mamie.rose@e2e.test");
  await adultsDialog.getByRole("button", { name: "Inviter", exact: true }).click();
  const invitationLink = await adultsDialog.locator(".family-created-invite code").textContent();
  expect(invitationLink).toContain("familyInvite=");

  const relativeContext = await browser.newContext();
  const relativePage = await relativeContext.newPage();
  await relativePage.goto(invitationLink);
  await expect(relativePage.getByText(/vous invite comme grand-parent/i)).toBeVisible();
  await relativePage.getByRole("tab", { name: "Inscription" }).click();
  await relativePage.getByLabel("Votre prénom").fill("Rose");
  await relativePage.getByLabel("Mot de passe", { exact: true }).fill("MamieRose!42");
  await relativePage.getByLabel(/J’accepte les conditions d’utilisation/).check();
  await relativePage.getByRole("button", { name: "Créer et rejoindre la famille" }).click();

  await expect(relativePage.getByRole("navigation", { name: "Navigation du proche autorisé" })).toBeVisible();
  await expect(relativePage.getByRole("heading", { name: "Bonjour, Rose" })).toBeVisible();
  await expect(relativePage.getByRole("button", { name: "Écrire à Alice" })).toBeVisible();
  await expect(relativePage.getByRole("button", { name: "Gestion" })).toHaveCount(0);

  const protectedResults = await relativePage.evaluate(async () => {
    const [children, requests] = await Promise.all([
      fetch("/api/children").then(async (response) => ({ status: response.status, body: await response.json() })),
      fetch("/api/contact-requests").then(async (response) => ({ status: response.status, body: await response.json() })),
    ]);
    return { children, requests };
  });
  expect(protectedResults.children.status).toBe(200);
  expect(protectedResults.children.body.children.map((child) => child.name)).toEqual(["Alice"]);
  expect(protectedResults.children.body.children[0].trustedAccess).toEqual({
    messages: true,
    audioCalls: true,
    videoCalls: false,
    games: true,
  });
  expect(protectedResults.requests.status).toBe(403);

  const secondParentContext = await browser.newContext();
  const secondParentPage = await secondParentContext.newPage();
  await loginParent(secondParentPage, {
    email: "parent.chloe@e2e.test",
    password: "ClubhouseParent!42",
    name: "Sacha",
  });
  await secondParentPage.getByRole("button", { name: "Gestion" }).click();
  await secondParentPage.getByRole("button", { name: /Adultes de la famille/ }).click();

  const secondAdultsDialog = secondParentPage.getByRole("dialog", { name: "Adultes de la famille" });
  await secondAdultsDialog.getByLabel("Lien avec les enfants").selectOption("uncle_aunt");
  await secondAdultsDialog.getByLabel("Adresse e-mail").fill("mamie.rose@e2e.test");
  await secondAdultsDialog.getByRole("button", { name: "Inviter", exact: true }).click();
  const secondInvitationLink = await secondAdultsDialog.locator(".family-created-invite code").textContent();
  expect(secondInvitationLink).toContain("familyInvite=");

  await relativePage.goto(secondInvitationLink);
  const acceptanceDialog = relativePage.getByRole("dialog", { name: "Rejoindre Famille Chloé" });
  await expect(acceptanceDialog).toContainText("Invitation · Oncle ou tante");
  await acceptanceDialog.getByRole("button", { name: "Accepter l’invitation" }).click();

  await expect(relativePage.getByText("Proche autorisé · 2 familles")).toBeVisible();
  await expect(relativePage.getByRole("region", { name: "Famille Camille, Grand-parent" })).toContainText("Alice");
  await expect(relativePage.getByRole("region", { name: "Famille Chloé, Oncle ou tante" })).toContainText("Chloé");
  await expect(relativePage.getByRole("button", { name: "Écrire à Alice" })).toBeVisible();
  await expect(relativePage.getByRole("button", { name: "Écrire à Chloé" })).toBeVisible();
  await relativePage.getByRole("button", { name: /Toutes les conversations/ }).click();
  await expect(relativePage.getByRole("button", { name: "Ouvrir la conversation avec Alice" })).toContainText("Grand-parent · Famille Camille");
  await expect(relativePage.getByRole("button", { name: "Ouvrir la conversation avec Chloé" })).toContainText("Oncle ou tante · Famille Chloé");
  await relativePage.getByRole("button", { name: "Mes proches" }).click();

  const multiFamilyResults = await relativePage.evaluate(async () => {
    const [children, family] = await Promise.all([
      fetch("/api/children").then((response) => response.json()),
      fetch("/api/family").then((response) => response.json()),
    ]);
    return { children, family };
  });
  expect(multiFamilyResults.children.children.map((child) => ({
    name: child.name,
    family: child.trustedFamily.name,
    relationship: child.trustedFamily.relationshipType,
  }))).toEqual([
    { name: "Alice", family: "Famille Camille", relationship: "grandparent" },
    { name: "Chloé", family: "Famille Chloé", relationship: "uncle_aunt" },
  ]);
  expect(multiFamilyResults.family.family.families.map((item) => ({
    name: item.name,
    relationship: item.relationshipType,
  }))).toEqual([
    { name: "Famille Camille", relationship: "grandparent" },
    { name: "Famille Chloé", relationship: "uncle_aunt" },
  ]);

  const stored = await queryE2eDatabase(
    `select account.role,family.name as family_name,adult.relationship_type,
       access.messages_enabled,access.audio_calls_enabled,
       access.video_calls_enabled,access.games_enabled
     from accounts account
     join family_trusted_adults adult on adult.account_id=account.id
     join families family on family.id=adult.family_id
     join family_trusted_adult_children access
       on access.family_id=adult.family_id and access.adult_id=adult.account_id
     where account.email='mamie.rose@e2e.test'
     order by family.name`,
  );
  expect(stored.rows).toEqual([
    {
      role: "relative",
      family_name: "Famille Camille",
      relationship_type: "grandparent",
      messages_enabled: true,
      audio_calls_enabled: true,
      video_calls_enabled: false,
      games_enabled: true,
    },
    {
      role: "relative",
      family_name: "Famille Chloé",
      relationship_type: "uncle_aunt",
      messages_enabled: true,
      audio_calls_enabled: true,
      video_calls_enabled: false,
      games_enabled: true,
    },
  ]);

  await relativePage.setViewportSize({ width: 390, height: 844 });
  await expect(relativePage.getByText("Proche autorisé · 2 familles")).toBeVisible();
  await expect(relativePage.getByRole("region", { name: "Famille Camille, Grand-parent" })).toBeVisible();
  await expect(relativePage.getByRole("region", { name: "Famille Chloé, Oncle ou tante" })).toBeVisible();
  await expectNoHorizontalOverflow(relativePage);

  await secondParentContext.close();
  await relativeContext.close();
  await parentContext.close();
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

  const successDialog = page.getByRole("dialog", { name: "Le compte de Zoé est prêt !" });
  await expect(successDialog).toBeVisible();
  await expect(successDialog).toContainText("Pseudo privé");
  await expect(successDialog).toContainText("@zoe.club");
  await expect(successDialog).toContainText("Code de contact");
  await expect(successDialog).toContainText("Ce code ne permet pas de se connecter.");
  await expect(successDialog).toContainText("Le mot de passe ne sera plus affiché");
  await successDialog.getByRole("button", { name: "Continuer dans mon espace parent" }).click();

  const zoeProfile = page.getByRole("button", { name: /Zoé 7 ans/ });
  await expect(zoeProfile).toBeVisible();
  await expect(zoeProfile).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Revoir les accès de connexion de Zoé" })).toContainText("@zoe.club");

  const aliceProfile = page.getByRole("button", { name: /Alice 9 ans/ });
  await aliceProfile.click();
  await expect(aliceProfile).toHaveAttribute("aria-pressed", "true");
  await expect(zoeProfile).toHaveAttribute("aria-pressed", "false");
});

test("après la création, le parent peut passer à la connexion de l’enfant", async ({ page }) => {
  await loginParent(page);
  await page.getByRole("button", { name: "Gestion" }).click();
  await page.getByRole("button", { name: "Ajouter" }).click();

  const dialog = page.getByRole("form", { name: "Créer un compte enfant" });
  await dialog.getByLabel("Prénom").fill("Nina");
  await dialog.getByLabel("Âge").selectOption("8");
  await dialog.getByLabel("Pseudo privé de connexion").fill("nina.club");
  await dialog.locator('input[type="password"]').fill("ClubhouseKid!43");
  await dialog.getByRole("button", { name: "Créer le compte" }).click();

  const successDialog = page.getByRole("dialog", { name: "Le compte de Nina est prêt !" });
  await successDialog.getByRole("button", { name: "Passer à l’espace de Nina" }).click();

  await expect(page.getByRole("tab", { name: "Enfant" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Salut, Nina !" })).toBeVisible();
  await expect(page.getByLabel("Ton pseudo privé")).toHaveValue("nina.club");
  await expect(page.getByText("Ton pseudo est déjà rempli. Saisis maintenant ton mot de passe.")).toBeVisible();
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
