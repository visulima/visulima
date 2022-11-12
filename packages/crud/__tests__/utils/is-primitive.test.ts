import { describe, expect, it } from "vitest";

import isPrimitive from "../../src/utils/is-primitive";

describe('Primitives', () => {
  it('should return true for primitives', () => {
    const nbr = 1
    const str = 'hello'
    const bool = true

    expect(isPrimitive(nbr)).toBe(true)
    expect(isPrimitive(str)).toBe(true)
    expect(isPrimitive(bool)).toBe(true)
  })

  it('should return false for non primitive types', () => {
    const obj = {}
    const arr: string[] = []
    const symbol = Symbol(0)

    expect(isPrimitive(obj)).toBe(false)
    expect(isPrimitive(arr)).toBe(false)
    expect(isPrimitive(symbol)).toBe(false)
  })
})
