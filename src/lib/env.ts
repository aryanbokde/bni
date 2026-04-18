import { z } from "zod";

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET is required"),

  // PII Encryption
  ENCRYPTION_KEY: z.string().min(1, "ENCRYPTION_KEY is required"),
  HASH_PEPPER: z.string().min(1, "HASH_PEPPER is required"),

  // WhatsApp — Meta Cloud API
  WHATSAPP_PROVIDER: z.string().min(1, "WHATSAPP_PROVIDER is required"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(10, "WHATSAPP_PHONE_NUMBER_ID must be at least 10 chars"),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(10, "WHATSAPP_BUSINESS_ACCOUNT_ID must be at least 10 chars"),
  WHATSAPP_API_TOKEN: z.string().min(20, "WHATSAPP_API_TOKEN must be at least 20 chars"),
  WHATSAPP_VERIFY_TOKEN: z.string().min(8, "WHATSAPP_VERIFY_TOKEN must be at least 8 chars"),
  WHATSAPP_TEMPLATE_NAME: z.string().default("bni_121_introduction"),

  // Google Maps
  NEXT_PUBLIC_GOOGLE_MAPS_KEY: z.string().min(1, "NEXT_PUBLIC_GOOGLE_MAPS_KEY is required"),
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1, "GOOGLE_MAPS_SERVER_KEY is required"),

  // App
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3000"),
  NEXT_PUBLIC_APP_URL: z.string().min(1, "NEXT_PUBLIC_APP_URL is required"),
});

// Warn about deprecated / confused OTP-related env vars
const deprecatedOtpVars = [
  "WHATSAPP_OTP_TEMPLATE_NAME",
  "OTP_EMAIL_FROM",
  "OTP_EMAIL_HOST",
  "OTP_EMAIL_PORT",
  "OTP_EMAIL_USER",
  "OTP_EMAIL_PASSWORD",
  "EMAIL_OTP_SECRET",
] as const;

for (const key of deprecatedOtpVars) {
  if (process.env[key]) {
    if (key === "WHATSAPP_OTP_TEMPLATE_NAME") {
      console.warn(
        `⚠  WARNING: ${key} is not used in this version. Auth uses email+password.`
      );
    } else {
      console.warn(
        `⚠  WARNING: ${key} is set but not used. This project uses email+password auth, not OTP.`
      );
    }
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.flatten().fieldErrors;
  const missing = Object.entries(errors)
    .map(([key, msgs]) => `  ${key}: ${msgs?.join(", ")}`)
    .join("\n");

  throw new Error(
    `❌ Missing or invalid environment variables:\n${missing}\n\nCheck your .env.local file.`
  );
}

export const env = parsed.data;
