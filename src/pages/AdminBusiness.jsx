import { useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { FormActions, Input, Select } from "../components/Field";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Alert } from "../components/ui/Feedback";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../context/useAuth";
import { useAsync } from "../hooks";
import { PLAN_OPTIONS, ago, eventText, formatDate, formatWhen, planLabel } from "../utils/admin";
import { formatMoney } from "../utils/format";
import { companyRoleName } from "../utils/roles";

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function Overview({ business }) {
  return (
    <Card title="Overview">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Fact label="Owner">{business.owner_name}</Fact>
        <Fact label="Email">
          {business.email || "None"}
          {business.email && !business.email_verified && " (not verified)"}
        </Fact>
        <Fact label="Joined">{business.created_at ? formatWhen(business.created_at) : "Before records began"}</Fact>
        <Fact label="Owner last logged in">{ago(business.last_login_at)}</Fact>
        <Fact label="People">{business.crew + 1}</Fact>
        <Fact label="Clients">{business.clients}</Fact>
        <Fact label="Jobs">{business.jobs}</Fact>
        <Fact label="Latest job">{formatDate(business.last_job_date) || "None yet"}</Fact>
      </dl>
    </Card>
  );
}

function PlanCard({ business, onChanged }) {
  const [plan, setPlan] = useState(business.plan || "");
  const [price, setPrice] = useState(business.plan_price ?? "");
  const [note, setNote] = useState(business.plan_note || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const errors = error?.data?.errors || {};
  const list = business.plans.find((item) => item.id === plan)?.list_price_cents;

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const body = { plan: plan || null, plan_price: String(price).trim() || null, plan_note: note.trim() || null };
      const next = await api(`/api/admin/businesses/${business.id}`, { method: "PATCH", body });
      onChanged(next);
      // Show what was saved, as the server wrote it ("19" becomes "19.00").
      setPlan(next.plan || "");
      setPrice(next.plan_price ?? "");
      setNote(next.plan_note || "");
      setSaved(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card
      title="Plan and price"
      description="A record of what this business is on and what you agreed to charge it. Nothing is charged from here yet: billing for memberships is not built."
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-fg">
          Now: <span className="font-medium">{planLabel(business)}</span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Plan" value={plan} onChange={(event) => setPlan(event.target.value)} error={errors.plan?.[0]}>
            {PLAN_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Agreed price a month"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            inputMode="decimal"
            placeholder={Number.isInteger(list) ? `List price ${formatMoney(list)}` : "0.00"}
            hint="Leave empty to use the plan's list price. 0 is free."
            error={errors.plan_price?.[0]}
          />
        </div>
        <Input
          label="Note (only admins see it)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={200}
          placeholder="Founding customer, half price for a year"
          error={errors.plan_note?.[0]}
        />
        {error && !Object.keys(errors).length && <ErrorMessage error={error} />}
        <FormActions>
          {saved && <span className="self-center text-sm text-muted" role="status">Saved</span>}
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </FormActions>
      </form>
    </Card>
  );
}

// The business's public website: where it is, and taking it down when it should not be on this address.
function SiteCard({ business, onChanged }) {
  const { site } = business;
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function act(what) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await api(`/api/admin/businesses/${business.id}/site/${what}`, { method: "POST" }));
      setConfirming(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Website" description="The public site this business built. Taking it down keeps what they built, and they cannot publish it again until you allow it.">
      <div className="space-y-3">
        <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
          {site.published ? (
            <a href={site.url} target="_blank" rel="noreferrer" className="link [overflow-wrap:anywhere]">{site.url.replace(/^https?:\/\//, "")}</a>
          ) : (
            <span className="[overflow-wrap:anywhere]">{site.url.replace(/^https?:\/\//, "")}</span>
          )}
          {site.taken_down ? <Badge tone="danger">Taken down</Badge> : site.published ? <Badge tone="success">Live</Badge> : <Badge>Not published</Badge>}
        </p>
        {site.published && <p className="text-xs text-muted">Published {formatWhen(site.published_at)}</p>}
        {error && <ErrorMessage error={error} />}
        {site.taken_down ? (
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => act("allow")}>
            {busy ? "Working…" : "Allow publishing again"}
          </Button>
        ) : confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-fg">Take this website down? The owner is told in their Settings.</span>
            <Button variant="danger" size="sm" disabled={busy} onClick={() => act("unpublish")}>
              {busy ? "Working…" : "Yes, take it down"}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
            {site.published ? "Take the site down" : "Block publishing"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function PersonRow({ business, person, onSent }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const body = person.id === business.id ? {} : { user_id: person.id };
      setResult(await api(`/api/admin/businesses/${business.id}/password_reset`, { method: "POST", body }));
      onSent();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
            <span className="[overflow-wrap:anywhere]">{person.name}</span>
            <Badge>{companyRoleName(person.role)}</Badge>
            {person.pending && <Badge tone="warning">Waiting for approval</Badge>}
            {!person.is_active && !person.pending && <Badge tone="danger">Turned off</Badge>}
          </p>
          <p className="text-sm text-muted [overflow-wrap:anywhere]">
            {person.email || "No email"} · Last login: {ago(person.last_login_at).toLowerCase()}
          </p>
        </div>
        {person.email ? (
          <Button variant="secondary" size="sm" onClick={send} disabled={busy}>
            {busy ? "Sending…" : "Email a password reset"}
          </Button>
        ) : (
          <p className="text-xs text-muted">The owner sets this password, from Employees.</p>
        )}
      </div>
      {result && (
        <Alert tone={result.email_delivery === "resend" ? "success" : "warning"} className="mt-2">
          {result.email_delivery === "resend"
            ? `A reset link is on its way to ${result.name}. Their password stays the same until they use it.`
            : `Email is not set up on this server, so the link for ${result.name} was only written to the server log.`}
        </Alert>
      )}
      {error && <div className="mt-2"><ErrorMessage error={error} /></div>}
    </li>
  );
}

function SupportViewCard({ business }) {
  const { startSupportView } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const on = Boolean(business.support_access_until);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await startSupportView(business.id);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <Card
      title="See what they see"
      description="Open this business as its owner sees it, to help them. You can look at every page, and change, send, or download nothing."
    >
      <div className="space-y-3">
        {on ? (
          <Alert tone="info" title={`The owner has allowed this until ${formatWhen(business.support_access_until)}`}>
            They can see in Settings each time you look, and can turn it off at any moment.
          </Alert>
        ) : (
          <Alert tone="warning" title="The owner has not allowed this">
            Ask them to open Settings, find Support access, and turn it on for a day or more. Then come back here.
          </Alert>
        )}
        {error && <ErrorMessage error={error} />}
        <Button onClick={start} disabled={!on || busy || !business.is_active}>
          {busy ? "Opening…" : "Look at this business"}
        </Button>
      </div>
    </Card>
  );
}

// One business: who is in it, its plan, password resets, and the support view.
export default function AdminBusiness() {
  const { id } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const { data: business, setData, error } = useAsync(api, `/api/admin/businesses/${id}`, reloadKey);

  if (error) return <ErrorMessage error={error} />;
  if (!business) return <Loading variant="list" label="Loading the business…" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ to: "/admin", label: "Admin" }}
        title={business.business_name || "No business name"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {business.owner_name}
            {!business.is_active && <Badge tone="danger">Turned off</Badge>}
            {business.support_access_until && <Badge tone="primary">Support access on</Badge>}
          </span>
        }
      />
      <div className="space-y-6">
        <Overview business={business} />
        <SupportViewCard business={business} />
        <PlanCard business={business} onChanged={setData} />
        {business.site && <SiteCard business={business} onChanged={setData} />}
        <Card title="People" description="Email someone a link to choose a new password. You never see the link or a password.">
          <ul className="-my-3 divide-y divide-border">
            {business.people.map((person) => (
              <PersonRow key={person.id} business={business} person={person} onSent={() => setReloadKey((key) => key + 1)} />
            ))}
          </ul>
        </Card>
        <Card title="Record" description="What admins did here and what the owner allowed, newest first.">
          {business.events.length === 0 ? (
            <p className="text-sm text-muted">Nothing yet.</p>
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {business.events.map((event) => (
                <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2 text-sm">
                  <span className="min-w-0 text-fg [overflow-wrap:anywhere]">{eventText(event)}</span>
                  <span className="shrink-0 text-xs text-muted">{formatWhen(event.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
