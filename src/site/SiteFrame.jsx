import { Link } from "react-router-dom";
import { SiteButton } from "./blocks";
import { useSite } from "./SiteContext";
import { mailHref, pagePath, telHref, themeVars } from "./siteUtils";

// What is around every page of a business's website: its colors and font, a header with
// the business's name, the menu of pages, the phone and a button, and a footer.
// current: the address of the page being shown ("" is the home page).
export default function SiteFrame({ current = "", children }) {
  const { site, editing } = useSite();
  const { settings } = site;
  const menu = site.pages.filter((page) => page.in_menu);
  const call = settings.show_phone ? telHref(settings.phone) : null;
  const mail = mailHref(settings.email);
  // In the editor a link does not leave the page being edited.
  const stop = editing ? (event) => event.preventDefault() : undefined;
  const cta = settings.cta === "none" ? null : { action: settings.cta === "call" ? "call" : "request" };

  return (
    <div className="flex min-h-dvh flex-col text-base antialiased" style={{ ...themeVars(settings), background: "var(--site-bg)", color: "var(--site-fg)" }}>
      <header className="border-b" style={{ borderColor: "var(--site-border)", background: "var(--site-bg)" }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <Link to={pagePath(site, "")} onClick={stop} className="min-w-0 no-underline" style={{ color: "var(--site-fg)" }}>
            <span className="block text-xl font-bold tracking-tight [font-family:inherit] [overflow-wrap:anywhere]">{site.name || "Your business"}</span>
            {settings.tagline && <span className="block text-sm" style={{ color: "var(--site-muted)" }}>{settings.tagline}</span>}
          </Link>
          {menu.length > 1 && (
            <nav aria-label="Pages" className="order-last flex w-full flex-wrap gap-x-5 gap-y-1 sm:order-none sm:w-auto sm:flex-1">
              {menu.map((page) => (
                <Link
                  key={page.slug}
                  to={pagePath(site, page.slug)}
                  onClick={stop}
                  aria-current={page.slug === current ? "page" : undefined}
                  className="py-1 text-sm font-medium no-underline"
                  style={{ color: page.slug === current ? "var(--site-accent)" : "var(--site-muted)" }}
                >
                  {page.title}
                </Link>
              ))}
            </nav>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {call && (
              <a href={call} onClick={stop} className="text-sm font-semibold no-underline" style={{ color: "var(--site-fg)" }}>
                {settings.phone}
              </a>
            )}
            {cta && <SiteButton link={cta} label={settings.cta_label || "Request a quote"} />}
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t px-4 py-8 text-sm sm:px-6" style={{ borderColor: "var(--site-border)", background: "var(--site-alt)", color: "var(--site-muted)" }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-semibold" style={{ color: "var(--site-fg)" }}>{site.name}</p>
            {settings.footer_text && <p className="mt-1 whitespace-pre-line">{settings.footer_text}</p>}
          </div>
          <div className="sm:text-right">
            {telHref(settings.phone) && (
              <p>
                <a href={telHref(settings.phone)} onClick={stop} style={{ color: "inherit" }}>{settings.phone}</a>
              </p>
            )}
            {mail && (
              <p>
                <a href={mail} onClick={stop} className="[overflow-wrap:anywhere]" style={{ color: "inherit" }}>{settings.email}</a>
              </p>
            )}
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-5xl text-xs opacity-80">Website made with Crew Job Tracker</p>
      </footer>
    </div>
  );
}
