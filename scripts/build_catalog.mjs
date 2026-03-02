import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const SYSTEMS_DIR = path.join(REPO_ROOT, "systems");
const CATALOG_DIR = path.join(REPO_ROOT, "catalog");
const CATALOG_PATH = path.join(CATALOG_DIR, "catalog.json");
const README_PATH = path.join(REPO_ROOT, "README.md");

const AUTO_START = "<!-- AUTO-LIST:START -->";
const AUTO_END = "<!-- AUTO-LIST:END -->";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function safeSlugFromFolder(folderName) {
  // enforce slug policy: lowercase letters/numbers/hyphens
  const ok = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folderName);
  assert(ok, `Invalid slug/folder name "${folderName}". Use lowercase letters/numbers/hyphens only.`);
  return folderName;
}

function buildSystemsIndex() {
  assert(exists(SYSTEMS_DIR), `Missing folder: ${SYSTEMS_DIR}`);

  const entries = fs.readdirSync(SYSTEMS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const systems = [];

  for (const folder of entries) {
    const slug = safeSlugFromFolder(folder);
    const sysDir = path.join(SYSTEMS_DIR, folder);

    const aggregationPath = path.join(sysDir, "aggregation.json");
    const configPath = path.join(sysDir, "config.json");
    const thumbPath = path.join(sysDir, "screenshots", "00_thumb.png");
    const metaPath = path.join(sysDir, "meta.json");

    // required files
    assert(exists(aggregationPath), `Missing ${path.relative(REPO_ROOT, aggregationPath)}`);
    assert(exists(configPath), `Missing ${path.relative(REPO_ROOT, configPath)}`);
    assert(exists(thumbPath), `Missing ${path.relative(REPO_ROOT, thumbPath)} (required thumbnail)`);

    // optional meta
    let meta = {};
    if (exists(metaPath)) {
      meta = readJson(metaPath);
    }

    const name = meta.name ?? slug;
    const description = meta.description ?? "";
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const license = meta.license ?? "";

    systems.push({
      slug,
      name,
      description,
      tags,
      license,
      thumbnail: `systems/${slug}/screenshots/00_thumb.png`,
      aggregation: `systems/${slug}/aggregation.json`,
      config: `systems/${slug}/config.json`
    });
  }

  return systems;
}

function writeCatalog(systems) {
  if (!exists(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });

  const catalog = {
    generated_at: new Date().toISOString(),
    count: systems.length,
    systems
  };

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf8");
}

function mdEscape(text) {
  return String(text).replace(/\|/g, "\\|").trim();
}

function buildReadmeSection(systems) {
  const lines = [];
  lines.push("");
  lines.push("| Preview | System | Tags | Files |");
  lines.push("|---|---|---|---|");

  for (const s of systems) {
    const tags = s.tags.length ? mdEscape(s.tags.join(", ")) : "";
    const desc = s.description ? ` — ${mdEscape(s.description)}` : "";
    const name = `**${mdEscape(s.name)}**${desc}`;
    const preview = `![](${s.thumbnail})`;
    const files = `[aggregation](${s.aggregation}) · [config](${s.config})`;
    lines.push(`| ${preview} | ${name} | ${tags} | ${files} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function updateReadme(systems) {
  assert(exists(README_PATH), "Missing README.md");

  const readme = fs.readFileSync(README_PATH, "utf8");
  const start = readme.indexOf(AUTO_START);
  const end = readme.indexOf(AUTO_END);

  assert(start !== -1 && end !== -1 && end > start, "README markers not found or in wrong order.");

  const before = readme.slice(0, start + AUTO_START.length);
  const after = readme.slice(end);

  const section = buildReadmeSection(systems);

  const next = `${before}\n${section}\n${after}`;
  fs.writeFileSync(README_PATH, next, "utf8");
}

const systems = buildSystemsIndex();
writeCatalog(systems);
updateReadme(systems);

console.log(`Generated ${path.relative(REPO_ROOT, CATALOG_PATH)} and updated README for ${systems.length} systems.`);