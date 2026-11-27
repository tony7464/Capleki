// Run with: npm test (node's built-in test runner; no extra dependencies).
import assert from "node:assert/strict";
import { test } from "node:test";
import { apiOriginForHost, joinApiBase, rewritePublicApiUrl } from "../src/utils/apiBase.js";

const VITE_BASE = "https://api.crewjobtrack.com";

test("empty base keeps relative /api paths", () => {
  assert.equal(joinApiBase("", "/api/check_session"), "/api/check_session");
  assert.equal(joinApiBase(undefined, "/api/jobs?page=2"), "/api/jobs?page=2");
  assert.equal(joinApiBase("   ", "/api/jobs"), "/api/jobs");
});

test("a set base prefixes the path with no double slash", () => {
  const base = "https://api.crewjobtrack.com";
  assert.equal(joinApiBase(base, "/api/check_session"), "https://api.crewjobtrack.com/api/check_session");
  assert.equal(joinApiBase(base + "/", "/api/jobs/1"), "https://api.crewjobtrack.com/api/jobs/1");
  assert.equal(joinApiBase(base + "//", "/api/jobs?when=today"), "https://api.crewjobtrack.com/api/jobs?when=today");
  assert.equal(joinApiBase(" http://localhost:5555 ", "/api/health"), "http://localhost:5555/api/health");
});

test("absolute and non-API URLs are left alone", () => {
  const base = "https://api.crewjobtrack.com";
  for (const url of [
    "https://checkout.stripe.com/c/pay/cs_test_1",
    "https://connect.stripe.com/setup/e/acct_1/xyz",
    "webcal://api.crewjobtrack.com/api/calendar/abc.ics",
    "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fx",
    "//evil.example/api/x",
    "blob:https://crewjobtrack.com/1234",
  ]) {
    assert.equal(joinApiBase(base, url), url);
  }
});

test("capleki.com and www.capleki.com use api.capleki.com, even if VITE_API_BASE is set", () => {
  for (const host of ["capleki.com", "www.capleki.com", "Capleki.com", "www.capleki.com."]) {
    assert.equal(apiOriginForHost(host, VITE_BASE), "https://api.capleki.com");
    assert.equal(
      joinApiBase(apiOriginForHost(host, VITE_BASE), "/api/check_session"),
      "https://api.capleki.com/api/check_session",
    );
    assert.equal(
      joinApiBase(apiOriginForHost(host, VITE_BASE), "/api/public/photos/1/thumb"),
      "https://api.capleki.com/api/public/photos/1/thumb",
    );
  }
});

test("other hosts keep VITE_API_BASE, including crewjobtrack.com and local dev", () => {
  for (const host of ["crewjobtrack.com", "www.crewjobtrack.com", "api.capleki.com", "localhost", "127.0.0.1", "", undefined]) {
    assert.equal(apiOriginForHost(host, VITE_BASE), VITE_BASE);
  }
  assert.equal(apiOriginForHost("crewjobtrack.com", "  https://api.crewjobtrack.com  "), VITE_BASE);
  assert.equal(apiOriginForHost("crewjobtrack.com", ""), "");
  assert.equal(apiOriginForHost("app.example.com", "http://localhost:5555"), "http://localhost:5555");
});

test("rewritePublicApiUrl remaps API links only on capleki.com page hosts", () => {
  const feed = "https://api.crewjobtrack.com/api/calendar/abc.ics";
  const webcal = "webcal://api.crewjobtrack.com/api/calendar/abc.ics";
  const google =
    "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fapi.crewjobtrack.com%2Fapi%2Fcalendar%2Fabc.ics";
  const stripe = "https://checkout.stripe.com/c/pay/cs_test_1";
  const frontend = "https://crewjobtrack.com/pay/tok";

  for (const host of ["capleki.com", "www.capleki.com"]) {
    assert.equal(rewritePublicApiUrl(feed, host), "https://api.capleki.com/api/calendar/abc.ics");
    assert.equal(rewritePublicApiUrl(webcal, host), "webcal://api.capleki.com/api/calendar/abc.ics");
    assert.equal(
      rewritePublicApiUrl(google, host),
      "https://calendar.google.com/calendar/render?cid=webcal%3A%2F%2Fapi.capleki.com%2Fapi%2Fcalendar%2Fabc.ics",
    );
    assert.equal(rewritePublicApiUrl(stripe, host), stripe);
    assert.equal(rewritePublicApiUrl(frontend, host), frontend);
  }

  for (const host of ["crewjobtrack.com", "www.crewjobtrack.com", "localhost"]) {
    assert.equal(rewritePublicApiUrl(feed, host), feed);
    assert.equal(rewritePublicApiUrl(webcal, host), webcal);
    assert.equal(rewritePublicApiUrl(google, host), google);
  }
  assert.equal(rewritePublicApiUrl("", "capleki.com"), "");
  assert.equal(rewritePublicApiUrl(undefined, "capleki.com"), undefined);
});
