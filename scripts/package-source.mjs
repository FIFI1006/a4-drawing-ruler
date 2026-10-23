import {
  readFile,
  readdir,
  mkdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
const root = process.cwd(),
  zip = new JSZip(),
  prefix = "a4-drawing-ruler/";
async function include(relative) {
  const absolute = path.join(root, relative);
  for (const item of await readdir(absolute, { withFileTypes: true })) {
    if (item.name === "downloads") continue;
    const name = path.posix.join(relative, item.name);
    if (item.isDirectory()) await include(name);
    else if (item.isFile())
      zip.file(prefix + name, await readFile(path.join(root, name)));
  }
}
for (const name of ["src", "public", "scripts", "tests", "dist"])
  await include(name);
for (const name of [
  "README.md",
  "TEST-REPORT.md",
  "V2-CHANGES.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vite.config.ts",
  "index.html",
  ".gitignore",
]) {
  try {
    zip.file(prefix + name, await readFile(path.join(root, name)));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
await mkdir(path.join(root, "dist/downloads"), { recursive: true });
await writeFile(
  path.join(root, "dist/downloads/a4-drawing-ruler.zip"),
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
);
for (const name of ["README.md", "TEST-REPORT.md", "V2-CHANGES.md"]) {
  try {
    await copyFile(
      path.join(root, name),
      path.join(root, "dist/downloads", name),
    );
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
console.log(
  "Current source, tests, documentation and production assets packaged in dist/downloads.",
);
