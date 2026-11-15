import { createContext, useContext } from "react";

// What every block of a business's website can read:
// - site: { slug, name, settings (with defaults filled in), pages, request_url, services }
// - editing: true inside the editor, where links and buttons do not go anywhere.
export const SiteContext = createContext(null);

export function useSite() {
  return useContext(SiteContext);
}
