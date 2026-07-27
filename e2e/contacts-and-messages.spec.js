import { test, expect } from "./fixtures.js";
import { e2eIds, e2eUsers, queryE2eDatabase } from "./database.js";
import { loginChild, loginParent } from "./helpers.js";

test("l’ajout d’un ami annonce les deux validations avant l’envoi", async ({ page }) => {
  await loginChild(page, e2eUsers.alice);
  await page.getByRole("button", { name: "Ajouter un ami avec un QR code" }).click();

  const dialog = page.getByRole("dialog", { name: "Ajouter un ami" });
  const approvalFlow = dialog.getByLabel("Les deux validations nécessaires");
  await expect(approvalFlow).toContainText("Ton parent confirme l’envoi");
  await expect(approvalFlow).toContainText("Le parent de ton ami accepte");
  await dialog.getByLabel("Identifiant de ton ami").fill("SC-200-000-002");
  await dialog.getByRole("button", { name: "Continuer avec mon parent" }).click();

  await expect(page.getByRole("heading", { name: "Des amis choisis. Des parents rassurés." })).toBeVisible();
  await page.getByLabel("Adresse e-mail").fill(e2eUsers.parent.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(e2eUsers.parent.password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  const parentDialog = page.getByRole("dialog", { name: `Demande pour ${e2eUsers.alice.name}` });
  await expect(parentDialog.getByLabel(`Profil concerné : ${e2eUsers.alice.name}`)).toBeVisible();
  await expect(parentDialog.getByLabel("Ajouter pour")).toHaveCount(0);
  await expect(parentDialog.getByRole("button", { name: "Confirmer et envoyer" })).toBeVisible();
});

test("les demandes reçues et envoyées sont clairement séparées", async ({ page }) => {
  const outgoingRequestId = "60000000-0000-4000-8000-000000000099";
  await queryE2eDatabase(
    `insert into contact_requests(
       id,requester_id,requested_by_parent_id,target_account_id,
       recipient_parent_id,status,created_at,updated_at
     )
     values($1,$2,$3,$4,$5,'pending',$6,$6)`,
    [
      outgoingRequestId,
      e2eIds.pausedChild,
      e2eIds.parent,
      e2eIds.dorian,
      e2eIds.approvedParent,
      "2026-07-22T10:00:00.000Z",
    ],
  );

  await loginParent(page);
  await expect(page.getByRole("heading", { name: "2 demandes à vérifier" })).toBeVisible();
  await page.getByRole("button", { name: "Gestion" }).click();

  const incomingSection = page.getByRole("region", { name: "À valider" });
  const outgoingSection = page.getByRole("region", { name: "Envoyées" });
  await expect(incomingSection.getByText("Basile")).toBeVisible();
  await expect(incomingSection.getByRole("button", { name: "Accepter" })).toHaveCount(2);
  await expect(outgoingSection.getByText("Dorian")).toBeVisible();
  await expect(outgoingSection).toContainText("En attente de l’autre famille");
  await expect(outgoingSection.getByRole("button", { name: "Accepter" })).toHaveCount(0);
  await expect(outgoingSection.getByRole("button", { name: "Refuser" })).toHaveCount(0);
});

test("un parent accepte et refuse deux demandes de contact déterministes", async ({ page }) => {
  await loginParent(page);
  await page.getByRole("button", { name: "Gestion" }).click();

  const basileRequest = page.locator("article.friend-request").filter({ hasText: "Basile" });
  const chloeRequest = page.locator("article.friend-request").filter({ hasText: "Chloé" });
  await expect(basileRequest).toBeVisible();
  await expect(chloeRequest).toBeVisible();

  await basileRequest.getByRole("button", { name: "Accepter" }).click();
  await expect(basileRequest).toBeHidden();
  await chloeRequest.getByRole("button", { name: "Refuser" }).click();
  await expect(chloeRequest).toBeHidden();

  await expect.poll(async () => {
    const result = await queryE2eDatabase(
      "select id,status,conversation_id from contact_requests where id=any($1::uuid[]) order by id",
      [[e2eIds.approveRequest, e2eIds.declineRequest]],
    );
    return result.rows;
  }).toEqual([
    {
      id: e2eIds.approveRequest,
      status: "approved",
      conversation_id: expect.any(String),
    },
    {
      id: e2eIds.declineRequest,
      status: "declined",
      conversation_id: null,
    },
  ]);
});

test("une conversation s’ouvre et un message est envoyé, reçu puis lu", async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const alicePage = await aliceContext.newPage();
  await loginChild(alicePage, e2eUsers.alice);
  await alicePage.locator("button.conversation-row").filter({ hasText: "Dorian" }).click();
  await expect(alicePage.getByRole("region", { name: "Conversation avec Dorian" })).toBeVisible();

  const messageText = "Coucou Dorian, rendez-vous au Clubhouse !";
  await alicePage.getByPlaceholder("Écris un message…").fill(messageText);
  await alicePage.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(alicePage.getByText(messageText)).toBeVisible();

  const dorianContext = await browser.newContext();
  const dorianPage = await dorianContext.newPage();
  await loginChild(dorianPage, e2eUsers.dorian);
  await dorianPage.locator("button.conversation-row").filter({ hasText: "Alice" }).click();
  await expect(dorianPage.getByRole("region", { name: "Conversation avec Alice" })).toBeVisible();
  await expect(dorianPage.getByText(messageText)).toBeVisible();

  await expect.poll(async () => {
    const result = await queryE2eDatabase(
      `select receipt.received_at is not null as received,receipt.seen_at is not null as seen
       from messages message
       join message_receipts receipt on receipt.message_id=message.id
       where message.conversation_id=$1
         and message.sender_id=$2
         and receipt.recipient_id=$3
       order by message.created_at desc
       limit 1`,
      [e2eIds.aliceDorianConversation, e2eIds.alice, e2eIds.dorian],
    );
    return result.rows[0] ?? null;
  }).toEqual({ received: true, seen: true });

  await alicePage.reload();
  await expect(alicePage.getByRole("heading", { name: "Salut, Alice !" })).toBeVisible();
  await alicePage.locator("button.conversation-row").filter({ hasText: "Dorian" }).click();
  await expect(alicePage.getByText(messageText)).toBeVisible();
  await expect(alicePage.getByLabel("Vu")).toBeVisible();

  await aliceContext.close();
  await dorianContext.close();
});

test("un enfant choisit un petit nom privé pour son parent puis retrouve le prénom d’origine", async ({ page }) => {
  await loginChild(page, e2eUsers.alice);
  await page.locator("button.conversation-row").filter({ hasText: "Camille" }).click();
  await expect(page.getByRole("region", { name: "Conversation avec Camille" })).toBeVisible();

  await page.getByRole("button", { name: "Changer le petit nom de Camille" }).click();
  const aliasDialog = page.getByRole("dialog", { name: "Comment veux-tu l’appeler ?" });
  await aliasDialog.getByRole("button", { name: "Papou", exact: true }).click();
  await aliasDialog.getByRole("button", { name: "Garder ce petit nom" }).click();
  await expect(page.getByRole("region", { name: "Conversation avec Papou" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Salut, Alice !" })).toBeVisible();
  await expect(page.locator("button.conversation-row").filter({ hasText: "Papou" })).toBeVisible();
  await expect.poll(async () => {
    const result = await queryE2eDatabase(
      `select contact_alias.alias
       from account_contact_aliases contact_alias
       where contact_alias.owner_account_id=$1 and contact_alias.target_account_id=$2`,
      [e2eIds.alice, e2eIds.parent],
    );
    return result.rows[0]?.alias ?? null;
  }).toBe("Papou");

  await page.locator("button.conversation-row").filter({ hasText: "Papou" }).click();
  await page.getByRole("button", { name: "Changer le petit nom de Camille" }).click();
  const resetDialog = page.getByRole("dialog", { name: "Comment veux-tu l’appeler ?" });
  await resetDialog.getByRole("button", { name: "Revenir à Camille" }).click();
  await expect(page.getByRole("region", { name: "Conversation avec Camille" })).toBeVisible();
});
