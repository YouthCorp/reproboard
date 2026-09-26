import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type DevAccount = { role: string; label: string; email: string; password: string };

export async function readDevAccounts(): Promise<DevAccount[] | null> {
  // Server-side gate: fixture credentials must never reach a production response.
  if (process.env.NODE_ENV !== "development" || process.env.DEV_LOGIN_ENABLED !== "true"
    || process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321") return null;
  try {
    const run = process.env.REPROBOARD_TEST_RUN;
    if (run !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(run)) return null;
    const file = run ? `.local/test-runs/${run}/accounts.json` : ".local/dev-accounts.json";
    const accounts = JSON.parse(await readFile(join(process.cwd(), file), "utf8"));
    if (!Array.isArray(accounts) || accounts.length !== 4 || !accounts.every((a) =>
      typeof a.email === "string" && a.email.endsWith("@reproboard.test") && typeof a.password === "string"
      && typeof a.label === "string" && ["owner", "member", "viewer", "outsider"].includes(a.role))) return null;
    return accounts.map(({ role, label, email, password }) => ({ role, label, email, password }));
  } catch { return null; }
}
