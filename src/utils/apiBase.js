// Joins the optional API origin onto a root-relative API path.
// Empty base: the path is returned as is ("/api/..."), for the Vite proxy and
// the monolith. Absolute URLs (Stripe, webcal, Google) are never touched.
//
// On capleki.com or www.capleki.com the API origin is https://api.capleki.com,
// so the session cookie stays same-site. Everywhere else, including
// crewjobtrack.com, the baked-in VITE_API_BASE is used.

const CAPLEKI_API_ORIGIN = "https://api.capleki.com";
const CAPLEKI_PAGE_HOSTS = new Set(["capleki.com", "www.capleki.com"]);

export function pageHostname() {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.hostname || "";
}

// Hostname of the page, and the baked VITE_API_BASE. Trailing dots on the host
// are ignored. capleki.com / www.capleki.com always win over VITE_API_BASE.
export function apiOriginForHost(hostname, viteBase = "") {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (CAPLEKI_PAGE_HOSTS.has(host)) return CAPLEKI_API_ORIGIN;
  return String(viteBase || "").trim();
}

// Server-built API links (ICS feeds, webcal, Google Calendar) still use
// api.crewjobtrack.com until API_PUBLIC_URL changes. When the page is on
// capleki.com, point those links at api.capleki.com too. Other URLs, including
// Stripe and crewjobtrack.com itself, are left alone.
export function rewritePublicApiUrl(url, hostname) {
  if (typeof url !== "string" || !url) return url;
  const host = hostname === undefined ? pageHostname() : hostname;
  if (apiOriginForHost(host, "") !== CAPLEKI_API_ORIGIN) return url;
  return url.replace(/api\.crewjobtrack\.com/gi, "api.capleki.com");
}

export function joinApiBase(base, path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) return path;
  const origin = (base || "").trim().replace(/\/+$/, "");
  return origin ? origin + path : path;
}
