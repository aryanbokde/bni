import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is not set");
  return Buffer.from(key, "hex");
}

function getHashPepper(): string {
  const pepper = process.env.HASH_PEPPER;
  if (!pepper) throw new Error("HASH_PEPPER is not set");
  return pepper;
}

export function encrypt(plaintext: string): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  // Format: iv(12 bytes) + tag(16 bytes) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(data: Buffer): string {
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

export function normalisePhone(phone: string): string {
  const hasPlus = phone.startsWith("+");
  const digits = phone.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function hashPhone(phone: string): string {
  const normalised = normalisePhone(phone);
  return crypto
    .createHmac("sha256", getHashPepper())
    .update(normalised)
    .digest("hex");
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashEmail(email: string): string {
  const normalised = normaliseEmail(email);
  return crypto
    .createHmac("sha256", getHashPepper())
    .update(normalised)
    .digest("hex");
}
