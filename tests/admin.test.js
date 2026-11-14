import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAN_OPTIONS, accessLength, ago, eventText, formatDate, formatWhen, planLabel, planName } from "../src/utils/admin.js";

test("a plan shows its price, and an agreed price beside the list price", () => {
  assert.equal(planLabel({ plan: null, plan_price_cents: null, list_price_cents: null }), "No plan");
  assert.equal(planLabel({ plan: "pro", plan_price_cents: null, list_price_cents: 9900 }), "Pro · $99.00 a month");
  assert.equal(planLabel({ plan: "crew", plan_price_cents: 1900, list_price_cents: 5900 }), "Crew · $19.00 a month (list $59.00)");
  // Free is a price too, and an agreed price equal to the list price needs no aside.
  assert.equal(planLabel({ plan: "solo", plan_price_cents: 0, list_price_cents: 2900 }), "Solo · $0.00 a month (list $29.00)");
  assert.equal(planLabel({ plan: "solo", plan_price_cents: 2900, list_price_cents: 2900 }), "Solo · $29.00 a month");
  assert.equal(planLabel({ plan: null, plan_price_cents: 1000, list_price_cents: null }), "No plan · $10.00 a month");
  assert.equal(planName("nope"), "No plan");
  assert.deepEqual(PLAN_OPTIONS.map(([value]) => value), ["", "solo", "crew", "pro"]);
});

test("how long ago something happened", () => {
  const now = Date.parse("2026-11-13T18:00:00Z");
  assert.equal(ago(null, now), "Never");
  assert.equal(ago("not a date", now), "Never");
  assert.equal(ago("2026-11-13T09:00:00+00:00", now), "Today");
  assert.equal(ago("2026-11-12T17:00:00+00:00", now), "Yesterday");
  assert.equal(ago("2026-11-01T18:00:00+00:00", now), "12 days ago");
  assert.equal(ago("2026-05-13T18:00:00+00:00", now), "6 months ago");
  assert.equal(ago("2023-11-13T18:00:00+00:00", now), "3 years ago");
  assert.equal(formatWhen(null), "");
  assert.equal(formatWhen("not a date"), "");
  assert.ok(formatWhen("2026-11-13T09:00:00+00:00").length > 5);
  // A calendar day keeps its day whatever the time zone.
  assert.equal(formatDate("2026-12-31"), "Dec 31, 2026");
  assert.equal(formatDate("2026-01-01"), "Jan 1, 2026");
  assert.equal(formatDate(null), "");
  assert.equal(formatDate("soon"), "");
});

test("support access lengths read as days", () => {
  assert.deepEqual([24, 72, 168].map(accessLength), ["1 day", "3 days", "7 days"]);
});

test("the record reads differently for the admin and for the owner", () => {
  const started = { action: "support_view_started", admin_name: "Root Owner", detail: null };
  assert.equal(eventText(started), "Root Owner started looking at this business");
  // The owner is never told which person.
  assert.equal(eventText(started, true), "Support started looking at your account");
  assert.equal(eventText({ action: "support_view_ended", admin_name: null }), "An admin stopped looking at this business");

  const on = { action: "support_access_on", detail: "For 3 days" };
  assert.equal(eventText(on), "The owner turned on support access for 3 days");
  assert.equal(eventText(on, true), "You turned on support access for 3 days");
  assert.equal(eventText({ action: "support_access_off" }, true), "You turned off support access");

  const reset = { action: "password_reset_sent", admin_name: "Root Owner", detail: "To Ann Owner" };
  assert.equal(eventText(reset), "Root Owner sent a password reset email to Ann Owner");
  assert.equal(eventText(reset, true), "Support sent a password reset email to Ann Owner");

  const plan = { action: "plan_changed", admin_name: "Root Owner", detail: "No plan -> Crew, $19.00 a month" };
  assert.equal(eventText(plan), "Root Owner changed the plan: No plan to Crew, $19.00 a month");
  assert.equal(eventText({ action: "admin_granted", detail: "ann (ann@example.com)" }), "Admin rights given to ann (ann@example.com)");
  assert.equal(eventText({ action: "admin_revoked", detail: null }), "Admin rights taken away");
  assert.equal(eventText({ action: "something_new", detail: null }), "something_new");
});
