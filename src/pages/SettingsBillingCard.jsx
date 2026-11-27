import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { Checkbox, Select } from "../components/Field";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { ANNUAL_MONTHS_FREE, PLANS, crewLabel, planById } from "../config/plans";
import { useAsync } from "../hooks";
import {
  INTERVALS,
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
} from "../utils/billing";
import { formatMoney } from "../utils/format";

const PATH = "/api/billing";

function post(path, body) {
  return api(`${PATH}/${path}`, { method: "POST", body: body || {} });
}

// A failed billing call: the server's message, and Stripe's own reason when it gave one
// (stripe_detail, with anything that looks like a key already removed by the server).
function BillingError({ error }) {
  if (!error) return null;
  const text = billingErrorText(error);
  if (!text) return <ErrorMessage error={error} />;
  const detail = error.data?.stripe_detail;
  return (
    <Alert tone="danger" title={text}>
      {detail ? <span className="break-words">Stripe said: {detail}</span> : null}
    </Alert>
  );
}

// Plan, monthly or annual, and the Website add-on (which Pro already includes).
function ChoiceFields({ choice, onChange, disabled }) {
  const plan = planById(choice.plan);
  const set = (changes) => onChange(cleanChoice({ ...choice, ...changes }));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Plan"
          value={choice.plan}
          disabled={disabled}
          onChange={(event) => set({ plan: event.target.value })}
          hint={plan ? crewLabel(plan) : null}
        >
          {PLANS.map((one) => (
            <option key={one.id} value={one.id}>
              {one.name} (${one.monthly} a month)
            </option>
          ))}
        </Select>
        <Select
          label="Billed"
          value={choice.interval}
          disabled={disabled}
          onChange={(event) => set({ interval: event.target.value })}
          hint={`Annual gives you ${ANNUAL_MONTHS_FREE} months free.`}
        >
          {INTERVALS.map((one) => (
            <option key={one.id} value={one.id}>
              {one.label}
            </option>
          ))}
        </Select>
      </div>
      {choice.plan === "pro" ? (
        <p className="text-sm text-muted">Pro includes your website.</p>
      ) : (
        <Checkbox
          name="website"
          label="Add the Website"
          description={`Your own business website, for $${WEBSITE_ADDON_MONTHLY} a month more.`}
          checked={choice.website}
          disabled={disabled}
          onChange={(event) => set({ website: event.target.checked })}
        />
      )}
      {plan && (
        <p className="text-sm font-medium text-fg">
          {priceLabel(choicePrice(plan, choice.interval, choice.website, ANNUAL_MONTHS_FREE), choice.interval)}
        </p>
      )}
    </div>
  );
}

// Change plan: choose, see what it costs and when it starts, then confirm.
function ChangePlan({ account, hasPending, onChanged, onClose }) {
  const [choice, setChoice] = useState(() => choiceOf(account));
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function choose(next) {
    setChoice(next);
    setPreview(null);
    setError(null);
  }

  async function run(work) {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  // Choosing what they already have only does something when a change is waiting (it drops it).
  const nothingToDo = sameChoice(choice, choiceOf(account)) && !hasPending;
  const check = () => run(async () => setPreview(await post("preview", choice)));
  const confirm = () =>
    run(async () => {
      const result = await post("change", { ...choice, proration_date: preview?.proration_date });
      onChanged(result);
    });

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <h3 className="text-sm font-semibold text-fg">Change plan</h3>
      <ChoiceFields choice={choice} onChange={choose} disabled={busy} />
      {preview && (
        <Alert tone="info" title={`Change to ${choiceLabel(preview)}`}>
          <p>{previewLine(preview, formatMoney)}</p>
          {preview.when === "now" && preview.lines.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {preview.lines.map((line, index) => (
                <li key={index} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{line.description}</span>
                  <span className="shrink-0">{formatMoney(line.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <BillingError error={error} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {preview ? (
          <Button onClick={confirm} disabled={busy} className="w-full sm:w-auto">
            {busy ? "Changing…" : preview.when === "now" ? `Confirm and pay ${formatMoney(preview.amount_due)}` : "Confirm change"}
          </Button>
        ) : (
          <Button onClick={check} disabled={busy || nothingToDo} className="w-full sm:w-auto">
            {busy ? "Checking…" : "See what changes"}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose} disabled={busy} className="w-full sm:w-auto">
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted">
        A bigger plan, adding the Website, or going annual starts now and is charged now. A smaller plan, removing the
        Website, or going monthly starts when the time you already paid for ends.
      </p>
    </div>
  );
}

const CHANGED_MESSAGES = {
  now: "Your plan is changed and paid for.",
  period_end: "Your plan will change when the time you paid for ends.",
  keep: "You are keeping the plan you have. The change that was waiting is dropped.",
};

export default function SettingsBillingCard() {
  const { data: billing, setData, error: loadError } = useAsync(api, PATH);
  const [searchParams, setSearchParams] = useSearchParams();
  const [returned] = useState(() => searchParams.get("billing"));
  const [sessionId] = useState(() => searchParams.get("session_id"));
  const [choice, setChoice] = useState({ plan: "crew", interval: "month", website: false });
  const [opening, setOpening] = useState(false);
  const [changing, setChanging] = useState(false);
  const [changed, setChanged] = useState(null);
  const [error, setError] = useState(null);
  const syncedOnLoad = useRef(false);

  // Drop ?billing=… and the session id from the address so a reload does not repeat them.
  useEffect(() => {
    if (!searchParams.has("billing") && !searchParams.has("session_id")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("billing");
    next.delete("session_id");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // The page shows what the app last heard, then asks Stripe once: after Checkout the
  // owner does not wait for the webhook, and a change that is waiting is shown.
  const syncOnLoad = Boolean(billing?.config.configured && (billing.account.has_customer || returned === "success"));
  const [syncDone, setSyncDone] = useState(false);
  useEffect(() => {
    if (!syncOnLoad || syncedOnLoad.current) return;
    syncedOnLoad.current = true;
    post("sync", returned === "success" && sessionId ? { session_id: sessionId } : {})
      .then(setData)
      .catch((err) => {
        if (err.data?.billing) setData(err.data.billing);
        setError(err);
      })
      .finally(() => setSyncDone(true));
  }, [syncOnLoad, returned, sessionId, setData]);
  const checking = syncOnLoad && !syncDone;

  async function open(path, body) {
    setOpening(true);
    setError(null);
    try {
      const result = await post(path, body);
      window.location.assign(result.url);
    } catch (err) {
      if (err.data?.billing) setData(err.data.billing);
      setError(err);
      setOpening(false);
    }
  }

  if (loadError) return <ErrorMessage error={loadError} />;
  if (!billing) return <Loading variant="list" label="Loading your plan…" />;

  const { account, config } = billing;
  const subscribed = isSubscribed(account);
  const badge = statusBadge(billing);
  const returnMessage = RETURN_MESSAGES[returned];
  const pending = pendingLine(billing.pending_change);
  const canChange = subscribed && ["active", "trialing"].includes(account.status);
  const modeBadge =
    config.configured &&
    (config.live ? null : (
      <Badge tone="warning" title="No real money moves">
        {config.mode === "mock" ? "Mock mode" : "Test mode"}
      </Badge>
    ));

  return (
    <Card
      title="Your plan"
      description="What you pay for the app: your plan, your card, and your invoices. Payments are handled by Stripe."
      actions={modeBadge}
    >
      <div className="space-y-5">
        {returnMessage && <Alert tone={returnMessage[0]}>{returnMessage[1]}</Alert>}
        {changed && <Alert tone="success">{CHANGED_MESSAGES[changed]}</Alert>}

        <div className="space-y-2">
          <Badge tone={badge.tone}>{badge.label}</Badge>
          {statusLines(billing).map((line) => (
            <p key={line} className="text-sm">
              {line}
            </p>
          ))}
          {pending && <p className="text-sm font-medium text-fg">{pending}</p>}
          {checking && <p className="text-xs text-muted">Checking with Stripe…</p>}
        </div>

        {!changing && <BillingError error={error} />}

        {!subscribed && !config.checkout_available && (
          <Alert tone="info" title="Plans cannot be bought here yet">
            Nothing changes for you in the meantime.
          </Alert>
        )}

        {!subscribed && config.checkout_available && (
          <div className="space-y-4">
            <ChoiceFields choice={choice} onChange={setChoice} disabled={opening} />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => open("checkout", choice)} disabled={opening || checking} className="w-full sm:w-auto">
                {opening ? "Opening Stripe…" : "Subscribe"}
              </Button>
              {account.has_customer && (
                <Button variant="secondary" onClick={() => open("portal")} disabled={opening} className="w-full sm:w-auto">
                  Manage billing
                </Button>
              )}
            </div>
            <p className="text-xs text-muted">You pay on Stripe&apos;s secure page, and you can cancel any time.</p>
          </div>
        )}

        {subscribed && !changing && (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              {canChange && (
                <Button
                  onClick={() => {
                    setChanged(null);
                    setError(null);
                    setChanging(true);
                  }}
                  disabled={opening}
                  className="w-full sm:w-auto"
                >
                  Change plan
                </Button>
              )}
              <Button
                variant={canChange ? "secondary" : undefined}
                onClick={() => open("portal")}
                disabled={opening || !config.portal_available}
                className="w-full sm:w-auto"
              >
                {opening ? "Opening Stripe…" : "Manage billing"}
              </Button>
            </div>
            <p className="text-xs text-muted">
              Manage billing opens Stripe, where you can change your card, see your invoices, and cancel.
            </p>
          </div>
        )}

        {subscribed && changing && (
          <ChangePlan
            account={account}
            hasPending={Boolean(billing.pending_change)}
            onClose={() => setChanging(false)}
            onChanged={(result) => {
              setData(result.billing);
              setChanged(result.result);
              setChanging(false);
            }}
          />
        )}
      </div>
    </Card>
  );
}
