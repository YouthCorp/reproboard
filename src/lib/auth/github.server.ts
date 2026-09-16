import "server-only";
import { siteOrigin } from "./navigation";

export type GithubStatus = "ready" | "disabled" | "unavailable" | "unconfigured";
export async function githubStatus(): Promise<GithubStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !siteOrigin()) return "unconfigured";
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key }, cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return "unavailable";
    const settings = await response.json();
    return settings.external?.github === true ? "ready" : "disabled";
  } catch { return "unavailable"; }
}
