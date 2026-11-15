import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import Loading from "../components/Loading";
import SiteView from "../site/SiteView";
import { pagePath } from "../site/siteUtils";

// A business's website as visitors see it: /site/<site> is the home page and
// /site/<site>/<page> the others. preview: the owner's drafts, before publishing.
export default function PublicSitePage({ preview = false }) {
  const { slug, page = "" } = useParams();
  const path = preview
    ? `/api/site/preview${page ? `?page=${encodeURIComponent(page)}` : ""}`
    : `/api/public/sites/${encodeURIComponent(slug)}${page ? `?page=${encodeURIComponent(page)}` : ""}`;
  // What was loaded, kept with the address it is for, so one page never shows under another's address.
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api(path, { skipAuth: !preview })
      .then((data) => !cancelled && setLoaded({ path, data }))
      .catch((error) => !cancelled && setLoaded({ path, error }));
    return () => {
      cancelled = true;
    };
  }, [path, preview]);

  const current = loaded?.path === path ? loaded : null;
  const data = current?.data;

  useEffect(() => {
    if (!data) return undefined;
    const before = document.title;
    document.title = data.page.slug ? `${data.page.title} · ${data.site.name}` : data.site.name || data.page.title;
    // The page's own address for search engines, in place of the app's home page.
    const canonical = preview ? null : document.querySelector('link[rel="canonical"]');
    const home = canonical?.getAttribute("href");
    canonical?.setAttribute("href", `${window.location.origin}${pagePath(data.site, data.page.slug)}`);
    return () => {
      document.title = before;
      if (home) canonical.setAttribute("href", home);
    };
  }, [data, preview]);

  if (!current) return <Loading label="Loading…" />;
  if (current.error) {
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-fg">This page is not here</h1>
        <p className="mt-2 text-sm text-muted">
          {current.error.status === 404 ? "The website may have been taken down, or the address may be mistyped." : current.error.message}
        </p>
        {preview && (
          <Link to="/website" className="link mt-4 inline-block text-sm">
            Back to the editor
          </Link>
        )}
      </main>
    );
  }

  // In a preview the pages are the owner's drafts, so its links stay inside the preview.
  const site = preview ? { ...data.site, base: "/website/preview" } : data.site;
  return (
    <>
      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-warning-soft px-4 py-2 text-sm text-warning-soft-fg">
          <span>This is a preview of your drafts. Visitors see the published site.</span>
          <Link to="/website" className="font-semibold underline">
            Back to the editor
          </Link>
        </div>
      )}
      <SiteView site={site} page={data.page} />
    </>
  );
}
