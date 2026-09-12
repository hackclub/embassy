function getEncryptionKeyBase64(): string {
  const key = process.env.PII_ENCRYPTION_KEY ?? "";
  if (!key) {
    throw new Error(
      "PII_ENCRYPTION_KEY is not set. Encrypting PII (Hackatime tokens, recipient details) needs a 16/24/32-byte AES-GCM key encoded as base64."
    );
  }
  return key;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const keyData = Buffer.from(getEncryptionKeyBase64(), "base64");
  if (![16, 24, 32].includes(keyData.length)) {
    throw new Error(
      `PII_ENCRYPTION_KEY must decode to 16, 24, or 32 bytes (got ${keyData.length}).`
    );
  }
  return crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptPII(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return Buffer.from(iv).toString("base64") + ":" + Buffer.from(encrypted).toString("base64");
}

export async function decryptPII(ciphertext: string): Promise<string> {
  if (!ciphertext) return "";
  const [ivB64, dataB64] = ciphertext.split(":");
  // Rows written before encryption existed (and other non-envelope values)
  // are treated as legacy plaintext so reads never hard-fail.
  if (!ivB64 || !dataB64) return ciphertext;
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const key = await getCryptoKey();
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}

export async function encryptPIIFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly (keyof T)[]
): Promise<T> {
  const result = { ...obj } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field as string];
    if (typeof value === "string" && value) {
      result[field as string] = await encryptPII(value);
    }
  }
  return result as T;
}

export async function decryptPIIFields<T extends Record<string, unknown>>(
  obj: T,
  fields: readonly (keyof T)[]
): Promise<T> {
  const result = { ...obj } as Record<string, unknown>;
  for (const field of fields) {
    const value = result[field as string];
    if (typeof value === "string" && value) {
      // A GCM auth failure (e.g. key rotation) must not take pages down;
      // fall back to the stored value.
      try {
        result[field as string] = await decryptPII(value);
      } catch {
        /* keep raw */
      }
    }
  }
  return result as T;
}

export const PII_FIELDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "stateProvince",
  "postalCode",
  "country",
  "dateOfBirth",
  "emergencyContact",
] as const;