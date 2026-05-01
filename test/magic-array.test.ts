import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { MagicArray } from '../src/index'

function runPair(source: string, apply: (m: MagicArray<string>, s: MagicString) => void) {
  const m = new MagicArray(source.split(''))
  const s = new MagicString(source)
  apply(m, s)
  expect(m.toArray().join('')).toBe(s.toString())
  return { m, s }
}

describe('magic-string parity', () => {
  it('matches insert ordering and boundaries', () => {
    runPair('abcd', (m, s) => {
      m.prepend('^').append('$')
      s.prepend('^').append('$')
      m.prependLeft(1, 'PL').appendLeft(1, 'AL')
      s.prependLeft(1, 'PL').appendLeft(1, 'AL')
      m.prependRight(1, 'PR').appendRight(1, 'AR')
      s.prependRight(1, 'PR').appendRight(1, 'AR')
      m.appendLeft(4, 'L4')
      s.appendLeft(4, 'L4')
    })
  })

  it('matches remove + overwrite + move', () => {
    runPair('abcdef', (m, s) => {
      m.appendLeft(1, 'x').appendRight(1, 'y').appendRight(3, 'z')
      s.appendLeft(1, 'x').appendRight(1, 'y').appendRight(3, 'z')
      m.remove(1, 3)
      s.remove(1, 3)
      m.overwrite(3, 5, ['Q'], { contentOnly: true })
      s.overwrite(3, 5, 'Q', { contentOnly: true })
      m.move(0, 1, 6)
      s.move(0, 1, 6)
    })
  })

  it('slice and snip semantics match magic-string', () => {
    const { m, s } = runPair('abcd', (m1, s1) => {
      m1.prepend('P').append('A').appendLeft(1, 'x').appendRight(1, 'y').remove(1, 2)
      s1.prepend('P').append('A').appendLeft(1, 'x').appendRight(1, 'y').remove(1, 2)
    })

    expect(m.slice(1, 3).join('')).toBe(s.slice(1, 3))

    const ms = m.snip(1, 3)
    const ss = s.snip(1, 3)
    expect(ms.toArray().join('')).toBe(ss.toString())
  })
})

describe('generic reference integrity', () => {
  it('does not mutate element references', () => {
    const obj = { n: 1 }
    const arr = [1, 2]
    const fn = () => 1
    const sym = Symbol('s')

    const src = [obj, arr, fn, sym]
    const m = new MagicArray(src)
    m.prependLeft(1, obj, arr)
    m.appendRight(2, fn, sym)
    m.overwrite(1, 2, [arr, fn])

    const out = m.toArray()
    expect(out).toContain(obj)
    expect(out).toContain(arr)
    expect(out).toContain(fn)
    expect(out).toContain(sym)
    expect(src[0]).toBe(obj)
    expect(src[1]).toBe(arr)
    expect(src[2]).toBe(fn)
    expect(src[3]).toBe(sym)
  })
})

describe('magic-array specific API', () => {
  it('keeps toString as JSON.stringify(toArray())', () => {
    const m = new MagicArray(['a', 'b', 'c'])
    m.remove(1)
    expect(m.toString()).toBe(JSON.stringify(m.toArray()))
  })

  it('hasRemoved/original/length/iterator work', () => {
    const m = new MagicArray(['a', 'b', 'c'])
    m.remove(1)
    expect(m.hasRemoved(1)).toBe(true)
    expect(m.original(1)).toBe('b')
    expect(m.length).toBe(3)
    expect([...m]).toEqual(m.toArray())
  })
})

describe('coverage matrix', () => {
  it('clone is independent and keeps move order parity', () => {
    const { m, s } = runPair('abcd', (m1, s1) => {
      m1.appendLeft(1, 'x').move(2, 4, 0)
      s1.appendLeft(1, 'x').move(2, 4, 0)
    })

    const mc = m.clone()
    const sc = s.clone()
    mc.remove(0, 1).appendRight(4, '!')
    sc.remove(0, 1).appendRight(4, '!')

    expect(mc.toArray().join('')).toBe(sc.toString())
    expect(m.toArray().join('')).toBe(s.toString())
  })

  it('reset and hasChanged cover full and partial resets', () => {
    const m = new MagicArray(['a', 'b', 'c', 'd'])
    m.prepend('^').append('$').remove(1).move(2, 4, 0)
    expect(m.hasChanged()).toBe(true)

    m.reset(1)
    expect(m.hasChanged()).toBe(true)

    m.reset()
    expect(m.hasChanged()).toBe(false)
    expect(m.toArray()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('omitted-end variants match magic-string semantics', () => {
    const { m, s } = runPair('abcd', (m1, s1) => {
      m1.remove(1)
      s1.remove(1, 2)
      m1.overwrite(2, undefined, ['X'])
      s1.overwrite(2, 3, 'X')
      m1.reset(2)
      s1.reset(2, 3)
    })

    expect(m.slice(2).join('')).toBe(s.slice(2, 3))
    expect(m.snip(1).toArray().join('')).toBe(s.snip(1, 2).toString())
  })

  it('boundary inserts at 0 and length match magic-string', () => {
    runPair('abcd', (m, s) => {
      m.prependLeft(0, 'PL0').appendLeft(0, 'AL0')
      s.prependLeft(0, 'PL0').appendLeft(0, 'AL0')
      m.prependRight(0, 'PR0').appendRight(0, 'AR0')
      s.prependRight(0, 'PR0').appendRight(0, 'AR0')

      m.prependLeft(4, 'PL4').appendLeft(4, 'AL4')
      s.prependLeft(4, 'PL4').appendLeft(4, 'AL4')
      m.prependRight(4, 'PR4').appendRight(4, 'AR4')
      s.prependRight(4, 'PR4').appendRight(4, 'AR4')
    })
  })

  it('overwrite default mode matches magic-string', () => {
    runPair('abcdef', (m, s) => {
      m.appendLeft(2, 'L').appendRight(2, 'R').appendRight(4, 'Z')
      s.appendLeft(2, 'L').appendRight(2, 'R').appendRight(4, 'Z')
      m.overwrite(2, 4, ['Q'])
      s.overwrite(2, 4, 'Q')
    })
  })

  it('throws for insertion index and move target boundary errors', () => {
    const m = new MagicArray(['a', 'b', 'c'])
    expect(() => m.prependLeft(-1, 'x')).toThrow(RangeError)
    expect(() => m.appendRight(4, 'x')).toThrow(RangeError)
    expect(() => m.move(0, 2, 1)).toThrow()
    expect(() => m.move(0, 1, 5)).toThrow(RangeError)
  })

  it('snip returns independent clone and keeps source untouched', () => {
    const m = new MagicArray(['a', 'b', 'c', 'd'])
    m.appendLeft(2, 'x').append('$')
    const snipped = m.snip(1, 3)

    const before = m.toArray()
    snipped.remove(1, 2).append('!')

    expect(m.toArray()).toEqual(before)
    expect(snipped.toArray()).not.toEqual(before)
  })
})

