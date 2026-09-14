import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

const VERSION = "v1";

function key() {
  const configured = getEnv().ENCRYPTION_KEY;
  const decoded = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, "hex")
    : Buffer.from(configured, "base64");
  return decoded.length === 32 ? decoded : createHash("sha256").update(configured).digest();
}

export function encryptSecret(value: string) {
  if (!value) throw new Error("Cannot encrypt an empty secret");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string) {
  const [version, ivText, tagText, ciphertextText] = payload.split(".");
  if (version !== VERSION || !ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted secret");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt secret");
  }
}
