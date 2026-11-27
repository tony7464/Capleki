// The owner's subscription, as Settings shows it (GET /api/billing; server/billing_stripe.py).
// Plain functions, so they can be tested without a browser. Plans come from config/plans.js.

// The Website add-on, in dollars a month. A year is the same months-free deal as the plans.
export const WEBSITE_ADDON_MONTHLY = 15;

export const INTERVALS = [
  { id: "month", label: "Monthly" },
  { id: "year", label: "Annual" },
];

// Stripe's statuses for a subscription that still stands. Anything else: none, or ended.
const SUBSCRIBED = ["active", "trialing", "past_due", "unpaid", "paused"];

export function isSubscribed(account) {
  return Boolean(account?.has_subscription) && SUBSCRIBED.includes(account.status);
}

// Pro includes the website, so it never carries the add-on.
export function cleanChoice({ plan, interval, website }) {
  return { plan, interval, website: plan === "pro" ? false : Boolean(website) };
}

export function choiceOf(account, fallback = { plan: "crew", interval: "month", website: false }) {
  if (!account?.plan || !account?.interval) return cleanChoice(fallback);
  return cleanChoice({ plan: account.plan, interval: account.interval, website: account.website });
}

export function sameChoice(a, b) {
  const one = cleanChoice(a);
  const two = cleanChoice(b);
  return one.plan === two.plan && one.interval === two.interval && one.website === two.website;
}

// What a choice costs each month or year, in whole dollars. plan: one of config/plans.js's.
export function choicePrice(plan, interval, website, annualMonthsFree = 2) {
  const monthly = plan.monthly + (website && plan.id !== "pro" ? WEBSITE_ADDON_MONTHLY : 0);
  return interval === "year" ? monthly * (12 - annualMonthsFree) : monthly;
}

export function priceLabel(dollars, interval) {
  return `$${dollars.toLocaleString("en-US")} a ${interval === "year" ? "year" : "month"}`;
}

export function billingDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function planName(id) {
  return id ? id.charAt(0).toUpperCase() + id.slice(1) : "";
}

// "Crew, monthly, with the Website"
export function choiceLabel(choice) {
  const { plan, interval, website } = cleanChoice(choice);
  const parts = [planName(plan), interval === "year" ? "annual" : "monthly"];
  if (website) parts.push("with the Website");
  if (plan === "pro") parts.push("website included");
  return parts.join(", ");
}

// The badge by the card's title: what the business has right now.
export function statusBadge(billing) {
  const { access, account } = billing;
  if (isSubscribed(account)) {
    if (account.status === "past_due" || account.status === "unpaid") return { tone: "danger", label: "Payment failed" };
    if (account.status === "paused") return { tone: "warning", label: "Paused" };
    if (account.cancel_at_period_end) return { tone: "warning", label: "Ending" };
    return { tone: "success", label: `${planName(account.plan)} plan` };
  }
  if (access.plan_source === "admin_comp" || access.plan_source === "launch_grace") {
    return { tone: "success", label: `${planName(access.plan)} plan` };
  }
  if (access.state === "trialing") return { tone: "primary", label: "Free trial" };
  return { tone: "neutral", label: "No plan" };
}

// One or two plain sentences under the badge.
export function statusLines(billing, formatDate = billingDate) {
  const { access, account } = billing;
  const lines = [];
  if (isSubscribed(account)) {
    lines.push(`You are on ${choiceLabel(choiceOf(account))}.`);
    const end = formatDate(account.current_period_end);
    if (account.status === "past_due" || account.status === "unpaid") {
      const until = formatDate(access.grace_ends_at);
      lines.push(
        `Your last payment did not go through. Update your card in Manage billing${until ? ` by ${until}` : ""}.`,
      );
    } else if (account.cancel_at_period_end) {
      lines.push(end ? `Your subscription ends on ${end}. You can keep it going in Manage billing.` : "Your subscription is set to end.");
    } else if (end) {
      lines.push(`It renews on ${end}.`);
    }
    return lines;
  }
  if (access.plan_source === "admin_comp" || access.plan_source === "launch_grace") {
    lines.push(`You have the ${planName(access.plan)} plan, and you are not being charged for it.`);
  } else if (access.state === "trialing") {
    const end = formatDate(access.trial_ends_at);
    lines.push(end ? `Your free trial runs until ${end}. No card is needed until you choose a plan.` : "You are in your free trial.");
  } else if (account.status === "canceled") {
    lines.push("Your subscription has ended. Choose a plan to start again.");
  } else {
    lines.push("You have no plan yet. Choose one below.");
  }
  return lines;
}

export function pendingLine(pending, formatDate = billingDate) {
  if (!pending) return null;
  const when = formatDate(pending.effective_at);
  return `Changing to ${choiceLabel(pending)}${when ? ` on ${when}` : " when the time you paid for ends"}.`;
}

// What a previewed change will do (POST /api/billing/preview), in words. money: cents to text.
export function previewLine(preview, money, formatDate = billingDate) {
  if (preview.when === "now") {
    return `Starts now. You pay ${money(preview.amount_due)} today for the rest of this period; any time you already paid for is taken off.`;
  }
  if (preview.when === "keep") {
    return "This keeps the plan you have now and drops the change that was waiting. Nothing is charged.";
  }
  const when = formatDate(preview.effective_at);
  return `Starts ${when ? `on ${when}` : "when the time you paid for ends"}. Nothing is charged today, and you keep what you have until then.`;
}

// Where Stripe sends the owner back to, as /settings?billing=…
export const RETURN_MESSAGES = {
  success: ["success", "Thanks! Your subscription is being set up. The plan below is what Stripe reports now."],
  cancelled: ["info", "Checkout was cancelled. Nothing was charged."],
  portal: ["info", "Back from Stripe. The plan below is what Stripe reports now."],
};

// The server's message for a failed billing call, or null to show the error the usual way.
export function billingErrorText(error) {
  const messages = error?.data?.errors?.billing;
  return messages ? [].concat(messages).join(" ") : null;
}
