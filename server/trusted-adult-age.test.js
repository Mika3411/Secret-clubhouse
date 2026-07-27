import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateTrustedAdultBirthDate,
  maximumTrustedAdultBirthDate,
} from "../shared/trusted-adult-age.js";

const today = new Date("2026-07-27T12:00:00.000Z");

test("un proche est accepté le jour de ses 14 ans", () => {
  assert.deepEqual(
    evaluateTrustedAdultBirthDate("2012-07-27", today),
    { valid: true, reason: null },
  );
  assert.equal(maximumTrustedAdultBirthDate(today), "2012-07-27");
});

test("une personne de 13 ans reste sous contrôle parental", () => {
  assert.deepEqual(
    evaluateTrustedAdultBirthDate("2012-07-28", today),
    { valid: false, reason: "underage" },
  );
});

test("une date impossible ou invraisemblable est refusée", () => {
  assert.equal(evaluateTrustedAdultBirthDate("2012-02-30", today).reason, "invalid");
  assert.equal(evaluateTrustedAdultBirthDate("1900-07-26", today).reason, "invalid");
  assert.equal(evaluateTrustedAdultBirthDate("", today).reason, "invalid");
});
