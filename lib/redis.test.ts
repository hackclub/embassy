import { describe, expect, it } from "bun:test";
import { getClientIdentifier } from "./redis";

describe("getClientIdentifier", () => {
  it("uses the rightmost x-forwarded-for hop (appended by the trusted proxy)", () => {
    const req = new Request("https://x.test/api", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8", "user-agent": "UA" },
    });
    const id = getClientIdentifier(req);
    expect(id).toStartWith("5.6.7.8:");
  });
  it("falls back to unknown when headers missing", () => {
    const id = getClientIdentifier(new Request("https://x.test/api"));
    expect(id).toStartWith("unknown:");
  });
});
