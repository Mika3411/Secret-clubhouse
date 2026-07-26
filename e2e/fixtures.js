import { test as base, expect } from "@playwright/test";
import { resetE2eDatabase } from "./database.js";

export const test = base.extend({
  isolatedDatabase: [async ({}, use) => {
    await resetE2eDatabase();
    await use();
  }, { auto: true }],
});

export { expect };
