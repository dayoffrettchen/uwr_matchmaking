export type RandomSource = { next(): number; int(maxExclusive: number): number; chance(probability: number): boolean; pick<T>(items: readonly T[]): T }

export function createPrng(seed: number): RandomSource {
  let state = seed >>> 0
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0
      let t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    int(maxExclusive: number) { return Math.floor(this.next() * Math.max(1, maxExclusive)) },
    chance(probability: number) { return this.next() < probability },
    pick<T>(items: readonly T[]) { return items[this.int(items.length)] },
  }
}
