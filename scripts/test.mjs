import assert from "node:assert/strict"
import fs from "node:fs"
import Module, { createRequire } from "node:module"
import path from "node:path"
import ts from "typescript"

const require = createRequire(import.meta.url)
const rootDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const tests = []
const suiteStack = []

const originalLoad = Module._load
const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith("@/")) {
    return originalResolveFilename.call(this, path.join(rootDir, request.slice(2)), parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

Module._load = function load(request, parent, isMain) {
  if (request === "vitest") {
    return { describe, expect, it }
  }
  return originalLoad.call(this, request, parent, isMain)
}

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  })
  module._compile(outputText, filename)
}

function describe(name, fn) {
  suiteStack.push(name)
  try {
    fn()
  } finally {
    suiteStack.pop()
  }
}

function it(name, fn) {
  tests.push({ name: [...suiteStack, name].join(" > "), fn, todo: false })
}

it.todo = function todo(name) {
  tests.push({ name: [...suiteStack, name].join(" > "), fn: null, todo: true })
}

function expect(received) {
  return {
    toBe(expected) {
      assert.equal(received, expected)
    },
    toEqual(expected) {
      assert.deepEqual(received, expected)
    },
    toContain(expected) {
      assert.ok(received?.includes(expected), `Expected ${JSON.stringify(received)} to contain ${JSON.stringify(expected)}`)
    },
    toHaveLength(expected) {
      assert.equal(received?.length, expected)
    },
    toBeGreaterThan(expected) {
      assert.ok(received > expected, `Expected ${received} to be greater than ${expected}`)
    },
    toBeGreaterThanOrEqual(expected) {
      assert.ok(received >= expected, `Expected ${received} to be greater than or equal to ${expected}`)
    },
    toBeLessThan(expected) {
      assert.ok(received < expected, `Expected ${received} to be less than ${expected}`)
    },
    toBeLessThanOrEqual(expected) {
      assert.ok(received <= expected, `Expected ${received} to be less than or equal to ${expected}`)
    },
  }
}

function findTestFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === "dist" || entry.name === "build" || entry.name === "coverage" || entry.name === "generated") {
      return []
    }
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return findTestFiles(fullPath)
    return /\.(test|spec)\.tsx?$/.test(entry.name) ? [fullPath] : []
  })
}

for (const testFile of findTestFiles(rootDir)) {
  require(testFile)
}

let failed = 0
for (const { name, fn, todo } of tests) {
  if (todo) {
    console.log(`○ TODO ${name}`)
    continue
  }
  try {
    await fn()
    console.log(`✓ ${name}`)
  } catch (error) {
    failed += 1
    console.error(`✗ ${name}`)
    console.error(error)
  }
}

const todo = tests.filter((test) => test.todo).length
console.log(`\n${tests.length - failed - todo} passed, ${failed} failed, ${todo} todo, ${tests.length} total`)
if (failed > 0) process.exitCode = 1
