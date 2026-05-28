import { describe, it, expect } from "vitest";
import { isSafeCallbackUrl } from "./safeUrl";

describe("isSafeCallbackUrl — REJECT list", () => {
  const cases: [string, string][] = [
    ["https://evil.com",          "absolute https external"],
    ["http://evil.com",           "absolute http external"],
    ["//evil.com",                "protocol-relative"],
    ["/\\evil.com",               "backslash after slash (normalises to //evil.com)"],
    ["\\\\evil.com",              "double-backslash prefix"],
    ["javascript:alert(1)",       "javascript: scheme"],
    ["data:text/html,<h1>x</h1>","data: scheme"],
    ["http:/evil.com",            "single-slash http (normalised to //evil.com by parser)"],
    ["https://localhost.evil.com","subdomain of evil.com"],
    ["https://localhost@evil.com","userinfo trick — actual host is evil.com"],
    ["https://user:pw@evil.com",  "credentials trick"],
  ];

  for (const [url, label] of cases) {
    it(`rejects ${label}: ${JSON.stringify(url)}`, () => {
      expect(isSafeCallbackUrl(url)).toBe(false);
    });
  }
});

describe("isSafeCallbackUrl — ACCEPT list", () => {
  const cases: [string, string][] = [
    ["/",                   "root"],
    ["/settings",           "simple path"],
    ["/checkout",           "checkout path"],
    ["/products?x=1",       "path with query string"],
    ["/products?x=1#top",   "path with query and hash"],
  ];

  for (const [url, label] of cases) {
    it(`accepts ${label}: ${JSON.stringify(url)}`, () => {
      expect(isSafeCallbackUrl(url)).toBe(true);
    });
  }
});
