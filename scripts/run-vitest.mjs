import fs from "node:fs"
import Module, { createRequire } from "node:module"
import path from "node:path"
import process from "node:process"
import ts from "typescript"

const root = process.cwd()
const require = createRequire(import.meta.url)
const shimPath = path.join(root, "test-shims", "vitest.cjs")
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request === "vitest") return shimPath
  if (request.startsWith("@/")) return originalResolveFilename.call(this, path.join(root, request.slice(2)), parent, isMain, options)
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

for (const extension of [".ts", ".tsx"]) {
  Module._extensions[extension] = function transpile(module, filename) {
    const source = fs.readFileSync(filename, "utf8")
    const output = ts.transpileModule(source, {
      compilerOptions: {
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: filename,
    }).outputText
    module._compile(output, filename)
  }
}

function collectTests(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") return []
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectTests(fullPath)
    return /\.(test|spec)\.tsx?$/.test(entry.name) ? [fullPath] : []
  })
}

for (const testFile of collectTests(root)) {
  require(testFile)
}

const { tests } = require(shimPath)
let failed = 0
for (const test of tests) {
  try {
    await test.fn()
    console.log(`✓ ${test.name}`)
  } catch (error) {
    failed++
    console.error(`✗ ${test.name}`)
    console.error(error?.stack ?? error)
  }
}

console.log(`\n${tests.length - failed} passed, ${failed} failed, ${tests.length} total`)
if (failed > 0) process.exit(1)
