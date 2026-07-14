const tests = []
const suiteStack = []

function describe(name, fn) {
  suiteStack.push(name)
  try { fn() } finally { suiteStack.pop() }
}

function it(name, fn) {
  tests.push({ name: [...suiteStack, name].join(" > "), fn })
}

function format(value) {
  return typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value)
}

function isEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected)
}

function expect(actual) {
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) throw new Error(`Expected ${format(actual)} to be ${format(expected)}`)
    },
    toEqual(expected) {
      if (!isEqual(actual, expected)) throw new Error(`Expected ${format(actual)} to equal ${format(expected)}`)
    },
    toHaveLength(expected) {
      if (actual == null || actual.length !== expected) throw new Error(`Expected length ${actual?.length} to be ${expected}`)
    },
    toContain(expected) {
      if (!actual?.includes?.(expected)) throw new Error(`Expected ${format(actual)} to contain ${format(expected)}`)
    },
    toBeLessThan(expected) {
      if (!(actual < expected)) throw new Error(`Expected ${format(actual)} to be less than ${format(expected)}`)
    },
    toBeLessThanOrEqual(expected) {
      if (!(actual <= expected)) throw new Error(`Expected ${format(actual)} to be less than or equal to ${format(expected)}`)
    },
    toBeGreaterThan(expected) {
      if (!(actual > expected)) throw new Error(`Expected ${format(actual)} to be greater than ${format(expected)}`)
    },
  }
}

module.exports = { describe, expect, it, tests }
