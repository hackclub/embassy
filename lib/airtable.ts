// Minimal Airtable REST client (no SDK dependency).
// Docs: https://airtable.com/developers/web/api/introduction

const API = "https://api.airtable.com/v0";

export class AirtableError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AirtableError";
    this.status = status;
  }
}

export function isAirtableConfigured(): boolean {
  return (
    (process.env.FEATURE_AIRTABLE ?? "").trim().toLowerCase() === "true" &&
    Boolean(process.env.AIRTABLE_API_KEY) &&
    Boolean(process.env.AIRTABLE_BASE_ID)
  );
}

function requireConfig() {
  const key = process.env.AIRTABLE_API_KEY;
  const base = process.env.AIRTABLE_BASE_ID;
  if (!key || !base) throw new AirtableError(0, "Airtable is not configured");
  return { key, base };
}

type AirtableJson =
  | { records?: AirtableRecord[]; offset?: string }
  | { tables?: Array<{ id: string; name: string }> }
  | Record<string, unknown>;

async function airtableFetch(path: string, init?: RequestInit): Promise<AirtableJson> {
  const { key } = requireConfig();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body?.error?.message ?? "";
    } catch {
      /* non-JSON error body */
    }
    throw new AirtableError(res.status, `Airtable ${res.status}: ${detail || res.statusText}`);
  }
  if (res.status === 204) return {};
  return (await res.json()) as AirtableJson;
}

export interface AirtableFieldSpec {
  name: string;
  type: "string" | "number" | "boolean" | "datetime";
}

const FIELD_TYPES: Record<AirtableFieldSpec["type"], string> = {
  string: "singleLineText",
  number: "number",
  boolean: "checkbox",
  datetime: "datetime",
};

export async function listBaseTables(): Promise<Array<{ id: string; name: string }>> {
  const { base } = requireConfig();
  const data = (await airtableFetchMeta(
    `/bases/${encodeURIComponent(base)}/tables`,
  )) as { tables?: Array<{ id: string; name: string }> };
  return (data.tables ?? []).map((t) => ({ id: t.id, name: t.name }));
}

async function airtableFetchMeta(path: string, init?: RequestInit): Promise<AirtableJson> {
  const { key } = requireConfig();
  // Metadata API lives at /v0/meta/... (records API is /v0/{base}/...).
  const res = await fetch(`${API}/meta${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new AirtableError(res.status, `Airtable ${res.status} (meta): ${res.statusText}`);
  }
  return (await res.json()) as AirtableJson;
}

export async function ensureTable(name: string, fields: AirtableFieldSpec[]): Promise<void> {
  const tables = await listBaseTables();
  if (tables.some((t) => t.name === name)) return;
  const { base } = requireConfig();
  await airtableFetchMeta(
    `/bases/${encodeURIComponent(base)}/tables`,
    {
      method: "POST",
      body: JSON.stringify({
        name,
        fields: fields.map((f) => ({ name: f.name, type: FIELD_TYPES[f.type] })),
      }),
    },
  );
}

export interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

export async function listRecords(
  table: string,
  fields: string[],
): Promise<AirtableRecord[]> {
  const { base } = requireConfig();
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams();
    for (const f of fields) params.append("fields[]", f);
    params.set("pageSize", "100");
    if (offset) params.set("offset", offset);
    const data = (await airtableFetch(
      `/${encodeURIComponent(base)}/${encodeURIComponent(table)}?${params.toString()}`,
    )) as { records?: AirtableRecord[]; offset?: string };
    all.push(...((data.records ?? []) as AirtableRecord[]));
    offset = data.offset;
  } while (offset);
  return all;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function createRecords(
  table: string,
  records: Array<{ fields: Record<string, unknown> }>,
): Promise<number> {
  const { base } = requireConfig();
  let count = 0;
  for (const batch of chunk(records, 10)) {
    await airtableFetch(`/${encodeURIComponent(base)}/${encodeURIComponent(table)}`, {
      method: "POST",
      body: JSON.stringify({ records: batch }),
    });
    count += batch.length;
  }
  return count;
}

export async function updateRecords(
  table: string,
  records: Array<{ id: string; fields: Record<string, unknown> }>,
): Promise<number> {
  const { base } = requireConfig();
  let count = 0;
  for (const batch of chunk(records, 10)) {
    await airtableFetch(`/${encodeURIComponent(base)}/${encodeURIComponent(table)}`, {
      method: "PATCH",
      body: JSON.stringify({ records: batch }),
    });
    count += batch.length;
  }
  return count;
}

export async function deleteRecords(table: string, ids: string[]): Promise<number> {
  const { base } = requireConfig();
  let count = 0;
  for (const batch of chunk(ids, 10)) {
    await airtableFetch(
      `/${encodeURIComponent(base)}/${encodeURIComponent(table)}/delete`,
      { method: "POST", body: JSON.stringify(batch) },
    );
    count += batch.length;
  }
  return count;
}
