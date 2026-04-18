import {
  encrypt,
  decrypt,
  hashPhone,
  hashEmail,
  normalisePhone,
  normaliseEmail,
} from "@/lib/crypto";

describe("encrypt / decrypt", () => {
  test("round-trip returns original string", () => {
    const original = "Hello, BNI World! +91 98765 43210";
    const encrypted = encrypt(original);
    expect(decrypt(encrypted)).toBe(original);
  });

  test("two encryptions of same string produce different ciphertexts", () => {
    const text = "same input";
    const a = encrypt(text);
    const b = encrypt(text);
    expect(a.equals(b)).toBe(false);
  });

  test("decrypt throws on tampered ciphertext", () => {
    const encrypted = encrypt("secret");
    // Tamper with the ciphertext portion (after IV + auth tag = 28 bytes)
    encrypted[28] ^= 0xff;
    expect(() => decrypt(encrypted)).toThrow();
  });
});

describe("hashPhone", () => {
  test("same input always returns same hash", () => {
    const a = hashPhone("+91 98765 43210");
    const b = hashPhone("+91 98765 43210");
    expect(a).toBe(b);
  });

  test("different inputs return different hashes", () => {
    const a = hashPhone("+919876543210");
    const b = hashPhone("+919876543211");
    expect(a).not.toBe(b);
  });

  test("normalises before hashing (spaces stripped)", () => {
    const a = hashPhone("+91 98765 43210");
    const b = hashPhone("+919876543210");
    expect(a).toBe(b);
  });
});

describe("hashEmail", () => {
  test("case-insensitive: User@Example.com === user@example.com", () => {
    const a = hashEmail("User@Example.com");
    const b = hashEmail("user@example.com");
    expect(a).toBe(b);
  });

  test("different emails return different hashes", () => {
    const a = hashEmail("alice@example.com");
    const b = hashEmail("bob@example.com");
    expect(a).not.toBe(b);
  });
});

describe("normaliseEmail", () => {
  test("trims whitespace and lowercases", () => {
    expect(normaliseEmail("  User@Example.COM  ")).toBe("user@example.com");
  });
});

describe("normalisePhone", () => {
  test("strips non-digits but preserves leading +", () => {
    expect(normalisePhone("+91 98765-43210")).toBe("+919876543210");
  });

  test("works without leading +", () => {
    expect(normalisePhone("098765 43210")).toBe("09876543210");
  });
});
