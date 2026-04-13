import { config as loadEnv } from "dotenv";

loadEnv();

function required(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getAppConfig() {
  return {
    port: Number(process.env.PORT ?? 4000),
    appBaseUrl: required("APP_BASE_URL", "http://localhost:4000"),
    webBaseUrl: required("WEB_BASE_URL", "http://localhost:5173"),
    databaseUrl: required("DATABASE_URL", "file:../data/gcodeline.db"),
    sessionSigningSecret: required("SESSION_SIGNING_SECRET", "dev-session-secret"),
    githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
    githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    githubWebhookSecret: required("GITHUB_WEBHOOK_SECRET", "dev-secret")
  };
}

export function githubOAuthEnabled() {
  const config = getAppConfig();
  return Boolean(config.githubClientId && config.githubClientSecret);
}
