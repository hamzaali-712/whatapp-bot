import dotenv from "dotenv";

dotenv.config();

const required = ["API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

if (process.env.API_SECRET!.length < 32) {
  throw new Error("API_SECRET must be at least 32 characters.");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",

  PORT: Number(process.env.PORT) || 5000,

  API_SECRET: process.env.API_SECRET!,

  SUPABASE_URL: process.env.SUPABASE_URL!,

  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  WHATSAPP_SESSION_ID: process.env.WHATSAPP_SESSION_ID || "main",

  WEBHOOK_URL: process.env.WEBHOOK_URL || "",

  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "",

  CORS_ORIGINS: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((v) => v.trim())
    : [],
};
