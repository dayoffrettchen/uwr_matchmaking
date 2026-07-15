#!/usr/bin/env node
import { readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const ignoredDirectories = new Set([
  '.git',
  '.next',
  'coverage',
  'node_modules',
  'public',
])
const lintedExtensions = new Set(['.cjs', '.js', '.mjs'])

function extensionOf(filePath) {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot === -1 ? '' : filePath.slice(lastDot)
}

function collectJavaScriptFiles(directory) {
  const entries = readdirSync(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const absolutePath = join(directory, entry.name)

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...collectJavaScriptFiles(absolutePath))
      }
      continue
    }

    if (entry.isFile() && lintedExtensions.has(extensionOf(entry.name))) {
      files.push(absolutePath)
    }
  }

  return files
}

const files = collectJavaScriptFiles(root)
let hasFailure = false

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    hasFailure = true
    const displayPath = relative(root, file)
    process.stderr.write(`Syntax check failed for ${displayPath}\n`)
    process.stderr.write(result.stderr)
    process.stderr.write(result.stdout)
  }
}

if (hasFailure) {
  process.exit(1)
}

console.log(`Checked ${files.length} JavaScript configuration file${files.length === 1 ? '' : 's'}.`)
