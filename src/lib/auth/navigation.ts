const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Authentication redirects only return to known app pages. Never reflect a host.
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/board";
  const url = new URL(value, "https://reproboard.invalid");
  if (url.pathname === "/invite") return "/invite";
  if (url.pathname !== "/board") return "/board";
  const workspace = url.searchParams.get("workspace");
  return workspace && uuid.test(workspace) ? `/board?workspace=${workspace}` : "/board";
}

export function siteOrigin(): string | null {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}
