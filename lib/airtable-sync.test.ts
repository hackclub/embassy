import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { syncMirrorTable, type MirrorTableConfig } from "./airtable-sync";

process.env.FEATURE_AIRTABLE = "true";
process.env.AIRTABLE_API_KEY = "key_test";
process.env.AIRTABLE_BASE_ID = "appTest";

type Call = { method: string; url: string; body?: unknown };
let calls: Call[] = [];
let airtableRows: Array<{ id: string; fields: Record<string, unknown> }> = [];
let realFetch: typeof fetch;

function stubFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });

    if (url.includes("/meta/bases/")) {
      return Response.json({ tables: [{ id: "tbl", name: "Things" }] });
    }
    if (url.includes("/delete")) {
      return Response.json({ records: (body as string[]).map((id) => ({ id, deleted: true })) });
    }
    if (method === "GET") {
      return Response.json({ records: airtableRows });
    }
    return Response.json({ records: [] });
  }) as typeof fetch;
}

const cfg: MirrorTableConfig = {
  table: "Things",
  fields: [
    { name: "id", type: "string" },
    { name: "name", type: "string" },
  ],
  rows: async () => [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ],
};

beforeEach(() => {
  realFetch = globalThis.fetch;
  calls = [];
  stubFetch();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("syncMirrorTable", () => {
  it("creates new rows, updates changed ones and prunes stale ones", async () => {
    airtableRows = [
      { id: "recA", fields: { id: "a", name: "A" } }, // unchanged
      { id: "recB", fields: { id: "b", name: "OLD" } }, // changed
      { id: "recZ", fields: { id: "z", name: "Gone" } }, // stale
    ];
    const result = await syncMirrorTable(cfg);
    expect(result.error).toBeUndefined();
    expect(result.unchanged).toBe(1);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(1);
    const patch = calls.find((c) => c.method === "PATCH");
    const patched = (patch?.body as { records?: Array<{ id: string }> } | undefined)?.records ?? [];
    expect(patched[0]?.id).toBe("recB");
    const del = calls.find((c) => c.url.includes("/delete"));
    expect((del?.body as string[] | undefined) ?? []).toEqual(["recZ"]);
  });

  it("creates rows that do not exist in Airtable", async () => {
    airtableRows = [];
    const result = await syncMirrorTable(cfg);
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it("never prunes when the source returned no rows (breaks can't wipe tables)", async () => {
    airtableRows = [{ id: "recA", fields: { id: "a", name: "A" } }];
    const result = await syncMirrorTable({ ...cfg, rows: async () => [] });
    expect(result.deleted).toBe(0);
  });

  it("reports errors instead of throwing", async () => {
    globalThis.fetch = (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;
    const result = await syncMirrorTable(cfg);
    expect(result.error).toContain("Airtable 500");
  });
});
