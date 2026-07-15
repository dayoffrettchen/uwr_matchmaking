import { readdir } from "node:fs/promises"
import { spawnSync } from "node:child_process"
import path from "node:path"

const root = process.cwd()
const ignoredDirectories = new Set([".git", ".next", "coverage", "node_modules", "public"])
const lintedExtensions = new Set([".cjs", ".js", ".mjs"])

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await collectJavaScriptFiles(path.join(directory, entry.name)))
      continue
    }

    if (entry.isFile() && lintedExtensions.has(path.extname(entry.name))) files.push(path.join(directory, entry.name))
  }

  return files
}

const files = await collectJavaScriptFiles(root)
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

console.log(`Checked ${files.length} JavaScript configuration file${files.length === 1 ? "" : "s"}.`)
