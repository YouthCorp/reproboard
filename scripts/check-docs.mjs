import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Offline by design: localhost examples and unavailable external sites do not
// turn a source-link check into a claim about a live deployment.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
async function collect(dir, recursive) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) files.push(target);
    else if (recursive && entry.isDirectory()) await collect(target, true);
  }
}
await collect(root, false);
await collect(path.join(root, "docs"), true);
await collect(path.join(root, ".github"), true);
const stripCode = (text) => text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
const anchorCache = new Map();
async function anchors(file) {
  if (anchorCache.has(file)) return anchorCache.get(file);
  const found = new Set();
  const counts = new Map();
  const body = stripCode(await readFile(file, "utf8"));
  for (const match of body.matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)) {
    const base = match[1].replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .toLowerCase().replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, "").replace(/\s/g, "-");
    const count = counts.get(base) ?? 0;
    found.add(count ? `${base}-${count}` : base);
    counts.set(base, count + 1);
  }
  for (const match of body.matchAll(/<(?:a|h[1-6])\s+[^>]*(?:id|name)=["']([^"']+)["']/g)) found.add(match[1]);
  anchorCache.set(file, found);
  return found;
}
const errors = [];
let localLinks = 0;
const external = new Set();
for (const file of files) {
  const body = stripCode(await readFile(file, "utf8"));
  const refs = [...body.matchAll(/!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  refs.push(...[...body.matchAll(/^\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)].map((m) => m[1]));
  for (let ref of refs) {
    ref = ref.replace(/^<|>$/g, "");
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref)) { external.add(ref); continue; }
    const [pathname, hash] = ref.split("#", 2);
    const relative = decodeURIComponent(pathname.split("?")[0]);
    const target = relative ? path.resolve(path.dirname(file), relative) : file;
    const label = `${path.relative(root, file).replaceAll("\\", "/")}: ${ref}`;
    const scoped = path.relative(root, target);
    if (scoped.startsWith("..") || path.isAbsolute(scoped)) { errors.push(`Outside repository: ${label}`); continue; }
    localLinks++;
    try {
      const info = await stat(target);
      if (hash && info.isFile() && target.endsWith(".md") && !(await anchors(target)).has(decodeURIComponent(hash))) {
        errors.push(`Missing heading: ${label}`);
      }
    } catch { errors.push(`Missing file: ${label}`); }
  }
}
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
for (const name of ["README.md", "CONTRIBUTING.md", "docs/DEVELOPMENT.md"]) {
  const body = await readFile(path.join(root, name), "utf8");
  for (const match of body.matchAll(/\bpnpm ([a-z][\w:-]*|--[\w-]+)/g)) {
    if (match[1].startsWith("--") || ["install", "exec", "store"].includes(match[1])) continue;
    if (!Object.hasOwn(pkg.scripts, match[1])) errors.push(`Unknown package script: ${name}: pnpm ${match[1]}`);
  }
}
if (pkg.license !== "MIT") errors.push("package.json license differs from LICENSE");
const license = await readFile(path.join(root, "LICENSE"), "utf8");
if (!license.includes("MIT License") || !license.includes("2026 ReproBoard contributors")) errors.push("Source license/copyright missing");
const fontLicense = await readFile(path.join(root, "public/fonts/SUIT-LICENSE.txt"), "utf8");
if (!fontLicense.includes("SIL OPEN FONT LICENSE Version 1.1") || !fontLicense.includes("SUNN")) errors.push("Bundled SUIT license missing");
process.stdout.write(JSON.stringify({ status: errors.length ? "FAIL" : "PASS", markdownFiles: files.length, localLinks, externalUrls: external.size, externalReachability: "NOT_RUN (offline checker)", errors }, null, 2) + "\n");
if (errors.length) process.exitCode = 1;
