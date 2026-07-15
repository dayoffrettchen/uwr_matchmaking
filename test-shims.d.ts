declare module "vitest" {
  type TestCallback = () => void | Promise<void>

  export function describe(name: string, fn: TestCallback): void
  export const it: {
    (name: string, fn: TestCallback): void
    todo(name: string): void
  }
  export function expect<T>(received: T): {
    toBe(expected: T): void
    toEqual(expected: unknown): void
    toContain(expected: unknown): void
    toHaveLength(expected: number): void
    toBeGreaterThan(expected: number): void
    toBeGreaterThanOrEqual(expected: number): void
    toBeLessThan(expected: number): void
    toBeLessThanOrEqual(expected: number): void
  }
}
