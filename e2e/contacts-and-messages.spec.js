import { test, expect } from "./fixtures.js";
import { e2eIds, e2eUsers, queryE2eDatabase } from "./database.js";
import { loginChild, loginParent } from "./helpers.js";

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
