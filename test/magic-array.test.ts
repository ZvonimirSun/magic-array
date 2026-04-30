import { describe, expect, it } from 'vitest'
import { MagicArray } from '../src/index'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ma<T>(arr: T[]) {
  return new MagicArray(arr)
}

// ---------------------------------------------------------------------------
// constructor / basic output
// ---------------------------------------------------------------------------

describe('constructor', () => {
  it('produces the original array unchanged', () => {
    expect(ma([1, 2, 3]).toArray()).toEqual([1, 2, 3])
  })

  it('works with an empty array', () => {
    expect(ma([]).toArray()).toEqual([])
  })

  it('does not mutate the source', () => {
    const src = [1, 2, 3]
    const m = ma(src)
    m.remove(0)
    expect(src).toEqual([1, 2, 3])
  })

  it('exposes the correct .length', () => {
    expect(ma([10, 20, 30]).length).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// toString
// ---------------------------------------------------------------------------

describe('toString', () => {
  it('returns JSON.stringify of toArray()', () => {
    const m = ma([1, 2, 3])
    expect(m.toString()).toBe(JSON.stringify(m.toArray()))
  })
})

// ---------------------------------------------------------------------------
// Symbol.iterator
// ---------------------------------------------------------------------------

describe('symbol.iterator', () => {
  it('iterates over the final array', () => {
    const m = ma([1, 2, 3])
    m.remove(1)
    expect([...m]).toEqual([1, 3])
  })
})

// ---------------------------------------------------------------------------
// original()
// ---------------------------------------------------------------------------

describe('original()', () => {
  it('returns the original element', () => {
    const m = ma([10, 20, 30])
    m.overwrite(1, undefined, 99)
    expect(m.original(1)).toBe(20)
  })

  it('throws for out-of-bounds index', () => {
    expect(() => ma([1]).original(5)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// prepend / append (global)
// ---------------------------------------------------------------------------

describe('prepend()', () => {
  it('inserts a single item at the start', () => {
    expect(ma([2, 3]).prepend(1).toArray()).toEqual([1, 2, 3])
  })

  it('inserts multiple items at the start', () => {
    expect(ma([3]).prepend([1, 2]).toArray()).toEqual([1, 2, 3])
  })

  it('multiple calls stack in LIFO order (last prepend is outermost)', () => {
    // prepend(1) then prepend(0) → unshift, so 0 ends up first
    expect(ma([2]).prepend(1).prepend(0).toArray()).toEqual([0, 1, 2])
  })
})

describe('append()', () => {
  it('inserts a single item at the end', () => {
    expect(ma([1, 2]).append(3).toArray()).toEqual([1, 2, 3])
  })

  it('inserts multiple items at the end', () => {
    expect(ma([1]).append([2, 3]).toArray()).toEqual([1, 2, 3])
  })

  it('multiple calls are in call order', () => {
    expect(ma([1]).append(2).append(3).toArray()).toEqual([1, 2, 3])
  })
})

// ---------------------------------------------------------------------------
// prependLeft / appendLeft / prependRight / appendRight
// ---------------------------------------------------------------------------

describe('prependLeft()', () => {
  it('inserts before the element (outermost on repeated calls)', () => {
    // prependLeft(1, 'A') then prependLeft(1, 'B') → B A original
    expect(ma([1, 2, 3]).prependLeft(1, 10).prependLeft(1, 0).toArray())
      .toEqual([1, 0, 10, 2, 3])
  })
})

describe('appendLeft()', () => {
  it('inserts just before the element (innermost)', () => {
    // appendLeft stacks after prependLeft
    expect(ma([1, 2, 3]).prependLeft(1, 10).appendLeft(1, 11).toArray())
      .toEqual([1, 10, 11, 2, 3])
  })
})

describe('prependRight()', () => {
  it('inserts just after the element (innermost)', () => {
    expect(ma([1, 2, 3]).prependRight(1, 20).prependRight(1, 21).toArray())
      .toEqual([1, 2, 21, 20, 3])
  })
})

describe('appendRight()', () => {
  it('inserts after the element (outermost)', () => {
    expect(ma([1, 2, 3]).appendRight(1, 20).appendRight(1, 21).toArray())
      .toEqual([1, 2, 20, 21, 3])
  })
})

describe('left/right ordering', () => {
  it('full order: prependLeft … appendLeft [element] prependRight … appendRight', () => {
    const m = ma(['x'])
    m.prependLeft(0, 'PL')
    m.appendLeft(0, 'AL')
    m.prependRight(0, 'PR')
    m.appendRight(0, 'AR')
    expect(m.toArray()).toEqual(['PL', 'AL', 'x', 'PR', 'AR'])
  })
})

// ---------------------------------------------------------------------------
// remove()
// ---------------------------------------------------------------------------

describe('remove()', () => {
  it('removes a single element (end omitted)', () => {
    expect(ma([1, 2, 3]).remove(1).toArray()).toEqual([1, 3])
  })

  it('removes a range [start, end)', () => {
    expect(ma([1, 2, 3, 4]).remove(1, 3).toArray()).toEqual([1, 4])
  })

  it('also clears surrounding insertions on removed elements', () => {
    const m = ma([1, 2, 3])
    m.appendLeft(1, 99)
    m.appendRight(1, 88)
    m.remove(1)
    expect(m.toArray()).toEqual([1, 3])
  })

  it('marks elements as removed (hasRemoved)', () => {
    const m = ma([1, 2, 3])
    m.remove(1)
    expect(m.hasRemoved(1)).toBe(true)
    expect(m.hasRemoved(0)).toBe(false)
  })

  it('throws for out-of-bounds start', () => {
    expect(() => ma([1, 2]).remove(5)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// overwrite()
// ---------------------------------------------------------------------------

describe('overwrite()', () => {
  it('replaces a single element', () => {
    expect(ma([1, 2, 3]).overwrite(1, undefined, 99).toArray()).toEqual([1, 99, 3])
  })

  it('replaces a range with multiple items', () => {
    expect(ma([1, 2, 3, 4]).overwrite(1, 3, [20, 21]).toArray()).toEqual([1, 20, 21, 4])
  })

  it('clears surrounding insertions by default (contentOnly: false)', () => {
    const m = ma([1, 2, 3])
    m.appendLeft(1, 99)
    m.appendRight(1, 88)
    m.overwrite(1, undefined, 50)
    expect(m.toArray()).toEqual([1, 50, 3])
  })

  it('preserves surrounding insertions on first element when contentOnly: true', () => {
    const m = ma([1, 2, 3])
    m.appendLeft(1, 99)
    m.appendRight(1, 88)
    m.overwrite(1, undefined, 50, { contentOnly: true })
    expect(m.toArray()).toEqual([1, 99, 50, 88, 3])
  })

  it('replaces a range with a single item', () => {
    expect(ma([1, 2, 3]).overwrite(0, 3, 0).toArray()).toEqual([0])
  })

  it('throws for out-of-bounds', () => {
    expect(() => ma([1]).overwrite(5, undefined, 0)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// move()
// ---------------------------------------------------------------------------

describe('move()', () => {
  it('moves a single element to an earlier position', () => {
    // [1, 2, 3, 4] → move index 3 to before index 1 → [1, 4, 2, 3]
    expect(ma([1, 2, 3, 4]).move(3, 4, 1).toArray()).toEqual([1, 4, 2, 3])
  })

  it('moves a single element to a later position', () => {
    // [1, 2, 3, 4] → move index 0 to before index 3 → [2, 3, 1, 4]
    expect(ma([1, 2, 3, 4]).move(0, 1, 3).toArray()).toEqual([2, 3, 1, 4])
  })

  it('moves a range to the end (targetIndex === length)', () => {
    expect(ma([1, 2, 3, 4]).move(0, 2, 4).toArray()).toEqual([3, 4, 1, 2])
  })

  it('moves a range to the beginning (targetIndex === 0)', () => {
    expect(ma([1, 2, 3, 4]).move(2, 4, 0).toArray()).toEqual([3, 4, 1, 2])
  })

  it('carries left/right insertions with the moved element', () => {
    const m = ma([1, 2, 3])
    m.appendLeft(2, 99) // insert 99 before original[2]
    m.move(2, 3, 0) // move original[2] to front
    expect(m.toArray()).toEqual([99, 3, 1, 2])
  })

  it('throws when targetIndex is inside the moved range', () => {
    expect(() => ma([1, 2, 3]).move(0, 2, 1)).toThrow()
  })

  it('throws for out-of-bounds targetIndex', () => {
    expect(() => ma([1, 2, 3]).move(0, 1, 10)).toThrow(RangeError)
  })
})

// ---------------------------------------------------------------------------
// hasChanged()
// ---------------------------------------------------------------------------

describe('hasChanged()', () => {
  it('returns false on a fresh instance', () => {
    expect(ma([1, 2, 3]).hasChanged()).toBe(false)
  })

  it('returns true after prepend', () => {
    expect(ma([1]).prepend(0).hasChanged()).toBe(true)
  })

  it('returns true after append', () => {
    expect(ma([1]).append(2).hasChanged()).toBe(true)
  })

  it('returns true after remove', () => {
    expect(ma([1, 2]).remove(0).hasChanged()).toBe(true)
  })

  it('returns true after overwrite', () => {
    expect(ma([1, 2]).overwrite(0, undefined, 99).hasChanged()).toBe(true)
  })

  it('returns true after prependLeft', () => {
    expect(ma([1, 2]).prependLeft(0, 0).hasChanged()).toBe(true)
  })

  it('returns true after move', () => {
    expect(ma([1, 2, 3]).move(0, 1, 2).hasChanged()).toBe(true)
  })

  it('returns false after full reset', () => {
    const m = ma([1, 2]).remove(0).reset()
    expect(m.hasChanged()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// clone()
// ---------------------------------------------------------------------------

describe('clone()', () => {
  it('produces an equal but independent copy', () => {
    const m = ma([1, 2, 3]).remove(1)
    const c = m.clone()
    expect(c.toArray()).toEqual(m.toArray())
    c.remove(0)
    expect(m.toArray()).toEqual([1, 3]) // original unaffected
    expect(c.toArray()).toEqual([3])
  })

  it('clones the move order', () => {
    const m = ma([1, 2, 3]).move(2, 3, 0)
    const c = m.clone()
    expect(c.toArray()).toEqual(m.toArray())
  })
})

// ---------------------------------------------------------------------------
// reset()
// ---------------------------------------------------------------------------

describe('reset()', () => {
  it('full reset restores the original array', () => {
    const m = ma([1, 2, 3])
    m.remove(0).prepend(0).append(4)
    m.reset()
    expect(m.toArray()).toEqual([1, 2, 3])
    expect(m.hasChanged()).toBe(false)
  })

  it('partial reset only restores the given range', () => {
    const m = ma([1, 2, 3, 4])
    m.remove(1).remove(2)
    m.reset(1, 2) // restore only index 1
    expect(m.toArray()).toEqual([1, 2, 4])
  })

  it('partial reset (end omitted) restores a single element', () => {
    const m = ma([1, 2, 3])
    m.remove(1)
    m.reset(1)
    expect(m.toArray()).toEqual([1, 2, 3])
  })

  it('full reset clears move order', () => {
    const m = ma([1, 2, 3]).move(2, 3, 0)
    m.reset()
    expect(m.toArray()).toEqual([1, 2, 3])
  })

  it('is chainable', () => {
    const m = ma([1, 2, 3])
    expect(m.reset()).toBe(m)
  })
})

// ---------------------------------------------------------------------------
// slice()
// ---------------------------------------------------------------------------

describe('slice()', () => {
  it('returns sub-array including insertions', () => {
    const m = ma([1, 2, 3])
    m.appendLeft(1, 10).appendRight(1, 20)
    expect(m.slice(1, 2)).toEqual([10, 2, 20])
  })

  it('covers a range', () => {
    const m = ma([1, 2, 3, 4])
    expect(m.slice(1, 3)).toEqual([2, 3])
  })

  it('end omitted defaults to single element', () => {
    expect(ma([1, 2, 3]).slice(1)).toEqual([2])
  })

  it('throws if any element in range has been removed', () => {
    const m = ma([1, 2, 3])
    m.remove(1)
    expect(() => m.slice(1)).toThrow()
  })
})

// ---------------------------------------------------------------------------
// snip()
// ---------------------------------------------------------------------------

describe('snip()', () => {
  it('returns a MagicArray scoped to the range', () => {
    const m = ma([1, 2, 3, 4])
    m.appendLeft(1, 10)
    const s = m.snip(1, 3)
    expect(s.toArray()).toEqual([10, 2, 3])
    expect(s.length).toBe(2)
  })

  it('end omitted → single element', () => {
    expect(ma([1, 2, 3]).snip(2).toArray()).toEqual([3])
  })

  it('does not carry global intro/outro', () => {
    const m = ma([1, 2, 3]).prepend(0).append(4)
    expect(m.snip(0, 3).toArray()).toEqual([1, 2, 3])
  })

  it('the snip is independent of the original', () => {
    const m = ma([1, 2, 3])
    const s = m.snip(1, 3)
    s.remove(0) // remove snip-local index 0 (original[1])
    expect(m.toArray()).toEqual([1, 2, 3]) // original unchanged
    expect(s.toArray()).toEqual([3])
  })
})

// ---------------------------------------------------------------------------
// Chaining
// ---------------------------------------------------------------------------

describe('chaining', () => {
  it('all mutating methods return this', () => {
    const m = ma([1, 2, 3, 4, 5])
    const result = m
      .prepend(0)
      .append(6)
      .prependLeft(2, 10)
      .appendLeft(2, 11)
      .prependRight(2, 12)
      .appendRight(2, 13)
      .remove(4)
      .overwrite(0, undefined, 1)
      .move(3, 4, 0)
      .reset(3)
    expect(result).toBe(m)
  })
})

// ---------------------------------------------------------------------------
// Interaction / composition
// ---------------------------------------------------------------------------

describe('composition', () => {
  it('prepend + append + insertions combine correctly', () => {
    const m = ma([2, 3])
    m.prepend(1).append(4).appendLeft(0, 1.5).prependRight(1, 3.5)
    expect(m.toArray()).toEqual([1, 1.5, 2, 3, 3.5, 4])
  })

  it('overwrite range then move what remains', () => {
    //  original: [A, B, C, D]
    //  overwrite [1,3) with X  → [A, X, D]
    //  move [0,1) to end       → [X, D, A]
    const m = ma(['A', 'B', 'C', 'D'])
    m.overwrite(1, 3, 'X')
    m.move(0, 1, 4)
    expect(m.toArray()).toEqual(['X', 'D', 'A'])
  })

  it('multiple removes leave only expected elements', () => {
    const m = ma([0, 1, 2, 3, 4])
    m.remove(1).remove(3)
    expect(m.toArray()).toEqual([0, 2, 4])
  })

  it('reset partial then continue editing', () => {
    const m = ma([1, 2, 3])
    m.remove(0).remove(1).remove(2)
    m.reset(1) // restore index 1 only
    expect(m.toArray()).toEqual([2])
    m.reset(0)
    expect(m.toArray()).toEqual([1, 2])
  })
})
