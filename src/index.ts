/**
 * MagicArray – manipulate arrays based on original indices.
 *
 * Inspired by magic-string. All positional arguments refer to
 * **original** indices of the source array, not the indices of
 * the already-mutated result. This makes it easy to compose
 * multiple edits (e.g. from an AST walk) without having to
 * track offset drift yourself.
 *
 * Supported operations (all chainable):
 *   .prepend(items)               – insert before the whole array
 *   .append(items)                – insert after  the whole array
 *   .prependLeft(index, items)    – insert before original[index] (outermost)
 *   .appendLeft(index, items)     – insert before original[index] (innermost)
 *   .prependRight(index, items)   – insert after  original[index] (innermost)
 *   .appendRight(index, items)    – insert after  original[index] (outermost)
 *   .remove(start, end?)          – remove original[start..end) (end exclusive)
 *   .overwrite(start, end, items) – replace original[start..end) keeping surrounding inserts
 *   .move(start, end, index)      – move original[start..end) to a new position
 *   .clone()                      – deep-clone this instance
 *   .reset(start?, end?)          – undo edits in the given original range (or everything)
 *   .hasChanged()                 – whether any edit has been made
 *   .slice(start, end?)           – return the edited sub-array for original[start..end)
 *   .snip(start, end?)            – clone retaining only original[start..end)
 *   .toString()                   – serialize via JSON.stringify
 *   .toArray()                    – return the final array
 */

// ---------------------------------------------------------------------------
// Internal chunk structure
// ---------------------------------------------------------------------------

interface Chunk<T> {
  /** Original index this chunk belongs to (−1 = global intro/outro sentinel). */
  originalIndex: number
  /**
   * intro  – global prepend (sentinel chunk only)
   * left   – content inserted before this element  (prependLeft / appendLeft)
   * content – the element itself; empty when removed/overwritten with nothing
   * right  – content inserted after  this element  (prependRight / appendRight)
   * outro  – global append  (sentinel chunk only)
   */
  intro: T[]
  left: T[]
  content: T[]
  right: T[]
  outro: T[]
  removed: boolean
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type { Chunk }

export interface OverwriteOptions {
  /**
   * When true, surrounding prependLeft/appendLeft/prependRight/appendRight
   * insertions are also cleared (equivalent to a full replacement).
   * Default: false (only the original element content is replaced).
   */
  contentOnly?: boolean
}

// ---------------------------------------------------------------------------
// MagicArray
// ---------------------------------------------------------------------------

export class MagicArray<T> {
  /** The original (immutable) array. */
  private readonly _original: ReadonlyArray<T>

  /**
   * One Chunk per original element, keyed by original index.
   * Key −1 is the sentinel that holds global intro/outro.
   */
  private readonly _chunks: Map<number, Chunk<T>>

  constructor(source: T[]) {
    this._original = Object.freeze([...source])
    this._chunks = new Map()

    // Sentinel for global intro / outro
    this._chunks.set(-1, {
      originalIndex: -1,
      intro: [],
      left: [],
      content: [],
      right: [],
      outro: [],
      removed: false,
    })

    for (let i = 0; i < this._original.length; i++) {
      this._chunks.set(i, {
        originalIndex: i,
        intro: [],
        left: [],
        content: [this._original[i]],
        right: [],
        outro: [],
        removed: false,
      })
    }
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _chunk(index: number): Chunk<T> {
    const c = this._chunks.get(index)
    if (c === undefined) {
      throw new RangeError(
        `Index ${index} is out of bounds for original array of length ${this._original.length}.`,
      )
    }
    return c
  }

  /** Normalise [start, end) – end defaults to start + 1. */
  private _range(start: number, end?: number): [number, number] {
    const len = this._original.length
    if (start < 0 || start >= len)
      throw new RangeError(`start (${start}) is out of bounds [0, ${len}).`)
    const e = end === undefined ? start + 1 : end
    if (e < start || e > len)
      throw new RangeError(`end (${e}) is out of bounds [${start}, ${len}].`)
    return [start, e]
  }

  // -------------------------------------------------------------------------
  // Global prepend / append
  // -------------------------------------------------------------------------

  /** Insert items at the very beginning of the result array. */
  prepend(items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._chunk(-1).intro.unshift(...arr)
    return this
  }

  /** Insert items at the very end of the result array. */
  append(items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._chunk(-1).outro.push(...arr)
    return this
  }

  // -------------------------------------------------------------------------
  // Positional inserts
  // -------------------------------------------------------------------------

  /**
   * Insert items just before original[index] – placed at the outermost left
   * position (before any prior appendLeft calls).
   */
  prependLeft(index: number, items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._chunk(index).left.unshift(...arr)
    return this
  }

  /**
   * Insert items just before original[index] – placed at the innermost left
   * position (after any prior prependLeft calls).
   */
  appendLeft(index: number, items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._chunk(index).left.push(...arr)
    return this
  }

  /**
   * Insert items just after original[index] – placed at the innermost right
   * position (before any prior appendRight calls).
   */
  prependRight(index: number, items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._chunk(index).right.unshift(...arr)
    return this
  }

  /**
   * Insert items just after original[index] – placed at the outermost right
   * position (after any prior prependRight calls).
   */
  appendRight(index: number, items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._chunk(index).right.push(...arr)
    return this
  }

  // -------------------------------------------------------------------------
  // Remove
  // -------------------------------------------------------------------------

  /**
   * Remove original elements in [start, end).
   * `end` defaults to `start + 1` (single element).
   * Surrounding left/right insertions for each removed element are also cleared.
   */
  remove(start: number, end?: number): this {
    const [s, e] = this._range(start, end)
    for (let i = s; i < e; i++) {
      const c = this._chunk(i)
      c.content = []
      c.left = []
      c.right = []
      c.removed = true
    }
    return this
  }

  // -------------------------------------------------------------------------
  // Overwrite  (mirrors magic-string semantics)
  // -------------------------------------------------------------------------

  /**
   * Replace original elements in [start, end) with `items`.
   *
   * By default (`contentOnly: false`) surrounding left/right insertions on
   * every element in the range are also cleared – the range is treated as a
   * single unit and only the new content remains.
   *
   * With `contentOnly: true` the surrounding insertions on the *first* element
   * are preserved; the rest of the range is still silently removed.
   *
   * `end` defaults to `start + 1` (single element).
   */
  overwrite(start: number, end: number | undefined, items: T | T[], options?: OverwriteOptions): this {
    const arr = Array.isArray(items) ? items : [items]
    const [s, e] = this._range(start, end)
    const contentOnly = options?.contentOnly ?? false

    const first = this._chunk(s)
    if (!contentOnly) {
      first.left = []
      first.right = []
    }
    first.content = [...arr]
    first.removed = false

    for (let i = s + 1; i < e; i++) {
      const c = this._chunk(i)
      c.content = []
      c.left = []
      c.right = []
      c.removed = true
    }
    return this
  }

  // -------------------------------------------------------------------------
  // Move
  // -------------------------------------------------------------------------

  /**
   * Move original elements in [start, end) so that they appear immediately
   * before the element currently at `targetIndex` in the result.
   *
   * `targetIndex` must be outside [start, end) and within [0, length].
   * The moved elements carry their left/right insertions with them.
   * Passing `targetIndex === length` moves the range to the end.
   */
  move(start: number, end: number, targetIndex: number): this {
    const [s, e] = this._range(start, end)
    const len = this._original.length

    if (targetIndex < 0 || targetIndex > len)
      throw new RangeError(`targetIndex (${targetIndex}) is out of bounds [0, ${len}].`)
    if (targetIndex >= s && targetIndex <= e)
      throw new Error(`targetIndex (${targetIndex}) must be outside the moved range [${s}, ${e}).`)

    // Collect the chunks to move
    const moving: Chunk<T>[] = []
    for (let i = s; i < e; i++) {
      moving.push({ ...this._chunk(i) })
    }

    // Build new ordered list of original indices
    const order: number[] = []
    for (let i = 0; i < len; i++) {
      if (i === targetIndex) {
        for (const c of moving) order.push(c.originalIndex)
      }
      if (i < s || i >= e)
        order.push(i)
    }
    if (targetIndex === len) {
      for (const c of moving) order.push(c.originalIndex)
    }

    // Re-key the chunks according to the new order, storing new order in a
    // parallel structure that toArray() can walk. We achieve this by remapping
    // via a dedicated _order array.
    (this as unknown as { _order: number[] })._order = order
    return this
  }

  // -------------------------------------------------------------------------
  // Clone / reset / hasChanged
  // -------------------------------------------------------------------------

  /** Return a deep clone of this MagicArray including all pending edits. */
  clone(): MagicArray<T> {
    const c = new MagicArray<T>([...this._original])
    for (const [key, chunk] of this._chunks) {
      c._chunks.set(key, {
        originalIndex: chunk.originalIndex,
        intro: [...chunk.intro],
        left: [...chunk.left],
        content: [...chunk.content],
        right: [...chunk.right],
        outro: [...chunk.outro],
        removed: chunk.removed,
      })
    }
    const order = (this as unknown as { _order?: number[] })._order
    if (order !== undefined)
      (c as unknown as { _order: number[] })._order = [...order]
    return c
  }

  /**
   * Reset all edits, or just those in original [start, end).
   * Resets also clear any pending move order for the affected indices.
   */
  reset(start?: number, end?: number): this {
    if (start === undefined) {
      const sentinel = this._chunk(-1)
      sentinel.intro = []
      sentinel.outro = []
      for (let i = 0; i < this._original.length; i++) {
        const c = this._chunk(i)
        c.left = []
        c.content = [this._original[i]]
        c.right = []
        c.removed = false
      }
      delete (this as unknown as { _order?: number[] })._order
    }
    else {
      const [s, e] = this._range(start, end)
      for (let i = s; i < e; i++) {
        const c = this._chunk(i)
        c.left = []
        c.content = [this._original[i]]
        c.right = []
        c.removed = false
      }
    }
    return this
  }

  /** Returns true if any edit has been applied (including move). */
  hasChanged(): boolean {
    const order = (this as unknown as { _order?: number[] })._order
    if (order !== undefined)
      return true
    const sentinel = this._chunk(-1)
    if (sentinel.intro.length > 0 || sentinel.outro.length > 0)
      return true
    for (let i = 0; i < this._original.length; i++) {
      const c = this._chunk(i)
      if (c.removed)
        return true
      if (c.left.length > 0 || c.right.length > 0)
        return true
      if (c.content.length !== 1 || c.content[0] !== this._original[i])
        return true
    }
    return false
  }

  // -------------------------------------------------------------------------
  // Slice / snip
  // -------------------------------------------------------------------------

  /**
   * Return the edited sub-array corresponding to original [start, end).
   * Includes left/right insertions for each element in the range,
   * but NOT the global intro/outro.
   * Throws if any element in the range has been removed.
   */
  slice(start: number, end?: number): T[] {
    const [s, e] = this._range(start, end)
    const result: T[] = []
    for (let i = s; i < e; i++) {
      const c = this._chunk(i)
      if (c.removed)
        throw new Error(`Cannot slice: original[${i}] has been removed.`)
      result.push(...c.left, ...c.content, ...c.right)
    }
    return result
  }

  /**
   * Return a clone of this MagicArray that retains only the content
   * corresponding to original [start, end).
   * The global intro/outro are NOT carried over.
   */
  snip(start: number, end?: number): MagicArray<T> {
    const [s, e] = this._range(start, end)
    const subOriginal = (this._original as T[]).slice(s, e)
    const snipped = new MagicArray<T>(subOriginal)
    for (let i = s; i < e; i++) {
      const src = this._chunk(i)
      const dst = snipped._chunks.get(i - s)!
      dst.left = [...src.left]
      dst.content = [...src.content]
      dst.right = [...src.right]
      dst.removed = src.removed
    }
    return snipped
  }

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------

  /** Return the final edited array. */
  toArray(): T[] {
    const result: T[] = []
    const sentinel = this._chunk(-1)
    result.push(...sentinel.intro)

    const order: number[] = (this as unknown as { _order?: number[] })._order
      ?? Array.from({ length: this._original.length }, (_, i) => i)

    for (const i of order) {
      const c = this._chunk(i)
      result.push(...c.left, ...c.content, ...c.right)
    }

    result.push(...sentinel.outro)
    return result
  }

  /** Serialize the final array via JSON.stringify. */
  toString(): string {
    return JSON.stringify(this.toArray())
  }

  /** Allow `for...of` iteration over the final array. */
  [Symbol.iterator](): Iterator<T> {
    return this.toArray()[Symbol.iterator]()
  }

  /** The length of the **original** source array. */
  get length(): number {
    return this._original.length
  }

  /** Read an element from the **original** source array. */
  original(index: number): T {
    if (index < 0 || index >= this._original.length)
      throw new RangeError(`Index ${index} is out of bounds.`)
    return this._original[index]
  }

  /** Returns true if the original element at `index` has been removed. */
  hasRemoved(index: number): boolean {
    return this._chunk(index).removed
  }
}
