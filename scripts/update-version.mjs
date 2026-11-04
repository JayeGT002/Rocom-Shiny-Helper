import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releasesPath = resolve(root, "data/releases.json");
const options = { level: "patch", title: "", notes: [], dryRun: false };

for (let index = 2; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--dry-run") {
    options.dryRun = true;
    continue;
  }
  if (["--level", "--title", "--note"].includes(argument)) {
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} 缺少内容`);
    index += 1;
    if (argument === "--level") options.level = value;
    if (argument === "--title") options.title = value.trim();
    if (argument === "--note") options.notes.push(value.trim());
    continue;
  }
  throw new Error(`不支持的参数：${argument}`);
}

if (!["patch", "minor", "major"].includes(options.level)) {
  throw new Error("版本级别只能是 patch、minor 或 major");
}
if (!options.title || options.notes.length === 0 || options.notes.some(note => !note)) {
  throw new Error("请提供 --title 和至少一个非空 --note");
}

const releases = JSON.parse(await readFile(releasesPath, "utf8"));
if (!Array.isArray(releases) || releases.length === 0) {
  throw new Error("data/releases.json 必须包含至少一条版本记录");
}

const parseVersion = version => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) throw new Error(`版本号格式错误：${version}`);
  return match.slice(1).map(Number);
};
const compareVersions = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
};

const versions = releases.map(release => parseVersion(release.version));
for (let index = 1; index < versions.length; index += 1) {
  if (compareVersions(versions[index - 1], versions[index]) <= 0) {
    throw new Error("data/releases.json 必须按版本号从新到旧排列，且不能重复");
  }
}

const [major, minor, patch] = versions[0];
const nextVersion = options.level === "major"
  ? [major + 1, 0, 0]
  : options.level === "minor"
    ? [major, minor + 1, 0]
    : [major, minor, patch + 1];
const date = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());
const release = {
  version: nextVersion.join("."),
  date,
  title: options.title,
  notes: options.notes
};

if (options.dryRun) {
  process.stdout.write(`${JSON.stringify(release, null, 2)}\n`);
} else {
  await writeFile(releasesPath, `${JSON.stringify([release, ...releases], null, 2)}\n`);
  process.stdout.write(`已更新为 v${release.version}，更新记录已写入 data/releases.json\n`);
}
