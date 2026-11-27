import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RETURN_MESSAGES,
  WEBSITE_ADDON_MONTHLY,
  billingErrorText,
  choiceLabel,
  choiceOf,
  choicePrice,
  cleanChoice,
  isSubscribed,
  pendingLine,
  previewLine,
  priceLabel,
  sameChoice,
  statusBadge,
  statusLines,
} from "../src/utils/billing.js";

// The Settings billing card's words and sums (utils/billing.js), for what GET /api/billing
// returns (server/routes/subscription.py).

const data = JSON.parse(readFileSync(new URL("../src/config/plans.json", import.meta.url)));
const plan = (id) => data.plans.find((one) => one.id === id);
const date = (iso) => (iso ? iso.slice(0, 10) : null);
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

const TRIAL = { state: "trialing", plan: null, plan_source: "trial", trial_ends_at: "2027-01-15T12:00:00Z", grace_ends_at: null };
const NO_ACCOUNT = { status: null, plan: null, interval: null, website: false, has_customer: false, has_subscription: false, cancel_at_period_end: false, current_period_end: null };
const CREW = { ...NO_ACCOUNT, status: "active", plan: "crew", interval: "month", website: true, has_customer: true, has_subscription: true, current_period_end: "2027-02-01T00:00:00Z" };
const ACTIVE = { state: "active", plan: "crew", plan_source: "stripe", trial_ends_at: null, grace_ends_at: null };

test("the prices are the approved ones", () => {
  const prices = {};
  for (const one of data.plans) {
    prices[one.id] = [choicePrice(one, "month", false, data.annualMonthsFree), choicePrice(one, "year", false, data.annualMonthsFree)];
  }
  assert.deepEqual(prices, { solo: [29, 290], crew: [59, 590], pro: [99, 990] });
  assert.equal(WEBSITE_ADDON_MONTHLY, 15);
  assert.equal(choicePrice(plan("solo"), "month", true), 44);
  assert.equal(choicePrice(plan("crew"), "year", true), 740);
  assert.equal(priceLabel(740, "year"), "$740 a year");
  assert.equal(priceLabel(1290, "month"), "$1,290 a month");
});

test("Pro includes the website and never carries the add-on", () => {
  assert.equal(choicePrice(plan("pro"), "month", true), 99);
  assert.equal(choicePrice(plan("pro"), "year", true), 990);
  assert.deepEqual(cleanChoice({ plan: "pro", interval: "year", website: true }), { plan: "pro", interval: "year", website: false });
  assert.equal(choiceLabel({ plan: "pro", interval: "year", website: true }), "Pro, annual, website included");
  assert.equal(choiceLabel({ plan: "crew", interval: "month", website: true }), "Crew, monthly, with the Website");
  assert.ok(sameChoice({ plan: "pro", interval: "month", website: true }, { plan: "pro", interval: "month", website: false }));
  assert.ok(!sameChoice({ plan: "crew", interval: "month", website: true }, { plan: "crew", interval: "month", website: false }));
});

test("only a subscription that still stands counts as subscribed", () => {
  assert.equal(isSubscribed(NO_ACCOUNT), false);
  assert.equal(isSubscribed(null), false);
  for (const status of ["active", "trialing", "past_due", "unpaid", "paused"]) assert.equal(isSubscribed({ ...CREW, status }), true, status);
  for (const status of ["canceled", "incomplete", null]) assert.equal(isSubscribed({ ...CREW, status }), false, String(status));
  assert.deepEqual(choiceOf(CREW), { plan: "crew", interval: "month", website: true });
  assert.deepEqual(choiceOf(NO_ACCOUNT), { plan: "crew", interval: "month", website: false });
});

test("the badge and the lines say what the business has", () => {
  const trial = { access: TRIAL, account: NO_ACCOUNT };
  assert.deepEqual(statusBadge(trial), { tone: "primary", label: "Free trial" });
  assert.match(statusLines(trial, date)[0], /free trial runs until 2027-01-15\. No card is needed/);

  const subscribed = { access: ACTIVE, account: CREW };
  assert.deepEqual(statusBadge(subscribed), { tone: "success", label: "Crew plan" });
  assert.deepEqual(statusLines(subscribed, date), ["You are on Crew, monthly, with the Website.", "It renews on 2027-02-01."]);

  const ending = { access: ACTIVE, account: { ...CREW, cancel_at_period_end: true } };
  assert.equal(statusBadge(ending).label, "Ending");
  assert.match(statusLines(ending, date)[1], /ends on 2027-02-01/);

  const behind = { access: { ...ACTIVE, state: "grace", grace_ends_at: "2027-02-08T00:00:00Z" }, account: { ...CREW, status: "past_due" } };
  assert.deepEqual(statusBadge(behind), { tone: "danger", label: "Payment failed" });
  assert.match(statusLines(behind, date)[1], /Update your card in Manage billing by 2027-02-08/);

  const ended = { access: { state: "read_only", plan: null, plan_source: null }, account: { ...CREW, status: "canceled" } };
  assert.deepEqual(statusBadge(ended), { tone: "neutral", label: "No plan" });
  assert.match(statusLines(ended, date)[0], /has ended/);

  const comp = { access: { state: "active", plan: "pro", plan_source: "admin_comp" }, account: NO_ACCOUNT };
  assert.equal(statusBadge(comp).label, "Pro plan");
  assert.match(statusLines(comp, date)[0], /not being charged/);
});

test("a preview says when the change starts and what is charged", () => {
  assert.match(previewLine({ when: "now", amount_due: 1234 }, money, date), /Starts now\. You pay \$12\.34 today/);
  assert.match(previewLine({ when: "period_end", amount_due: 0, effective_at: "2027-02-01T00:00:00Z" }, money, date), /Starts on 2027-02-01\. Nothing is charged today/);
  assert.match(previewLine({ when: "keep" }, money, date), /keeps the plan you have now/);
  assert.equal(pendingLine(null), null);
  assert.equal(
    pendingLine({ plan: "solo", interval: "month", website: false, effective_at: "2027-02-01T00:00:00Z" }, date),
    "Changing to Solo, monthly on 2027-02-01.",
  );
});

test("return messages and server errors", () => {
  assert.deepEqual(Object.keys(RETURN_MESSAGES).sort(), ["cancelled", "portal", "success"]);
  assert.equal(billingErrorText({ data: { errors: { billing: ["You already have a subscription."] } } }), "You already have a subscription.");
  assert.equal(billingErrorText({ data: { errors: { plan: ["Choose a plan"] } } }), null);
  assert.equal(billingErrorText(null), null);
});
