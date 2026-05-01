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

interface Boundary<T> { right: T[], left: T[] }

export class MagicArray<T> {
  private readonly _original: ReadonlyArray<T>
  private readonly _content: T[][]
  private readonly _removed: boolean[]
  private readonly _boundaries: Map<number, Boundary<T>>
  private _globalPrepend: T[]
  private _globalAppend: T[]
  private _tailRight: T[]
  private _order?: number[]

  constructor(source: T[]) {
    this._original = Object.freeze([...source])
    this._content = this._original.map(item => [item])
    this._removed = this._original.map(() => false)
    this._boundaries = new Map()
    this._globalPrepend = []
    this._globalAppend = []
    this._tailRight = []
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _boundary(owner: number): Boundary<T> {
    let b = this._boundaries.get(owner)
    if (b === undefined) {
      b = { right: [], left: [] }
      this._boundaries.set(owner, b)
    }
    return b
  }

  private _validateBoundaryIndex(index: number): void {
    const len = this._original.length
    if (index < 0 || index > len)
      throw new RangeError(`index (${index}) is out of bounds [0, ${len}].`)
  }

  private _leftOwner(index: number): number {
    return index - 1
  }

  private _defaultOrder(): number[] {
    return Array.from({ length: this._original.length }, (_, i) => i)
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
    this._globalPrepend.unshift(...arr)
    return this
  }

  /** Insert items at the very end of the result array. */
  append(items: T | T[]): this {
    const arr = Array.isArray(items) ? items : [items]
    this._globalAppend.push(...arr)
    return this
  }

  // -------------------------------------------------------------------------
  // Positional inserts
  // -------------------------------------------------------------------------

  /**
   * Insert items just before original[index] – placed at the outermost left
   * position (before any prior appendLeft calls).
   */
  prependLeft(index: number, ...items: T[]): this {
    this._validateBoundaryIndex(index)
    this._boundary(this._leftOwner(index)).left.unshift(...items)
    return this
  }

  /**
   * Insert items just before original[index] – placed at the innermost left
   * position (after any prior prependLeft calls).
   */
  appendLeft(index: number, ...items: T[]): this {
    this._validateBoundaryIndex(index)
    this._boundary(this._leftOwner(index)).left.push(...items)
    return this
  }

  /**
   * Insert items just after original[index] – placed at the innermost right
   * position (before any prior appendRight calls).
   */
  prependRight(index: number, ...items: T[]): this {
    this._validateBoundaryIndex(index)
    if (index === this._original.length)
      this._tailRight.unshift(...items)
    else
      this._boundary(index).right.unshift(...items)
    return this
  }

  /**
   * Insert items just after original[index] – placed at the outermost right
   * position (after any prior prependRight calls).
   */
  appendRight(index: number, ...items: T[]): this {
    this._validateBoundaryIndex(index)
    if (index === this._original.length)
      this._tailRight.push(...items)
    else
      this._boundary(index).right.push(...items)
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
      this._content[i] = []
      this._removed[i] = true
      this._boundaries.set(i, { right: [], left: [] })
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
  overwrite(start: number, end: number | undefined, items: T[], options?: OverwriteOptions): this {
    const [s, e] = this._range(start, end)
    const contentOnly = options?.contentOnly ?? false

    const keepBoundary = contentOnly ? this._boundary(s) : undefined
    const keepRight = keepBoundary ? [...keepBoundary.right] : []
    const keepLeft = keepBoundary ? [...keepBoundary.left] : []

    this.remove(s, e)

    if (keepBoundary !== undefined)
      this._boundaries.set(s, { right: keepRight, left: keepLeft })

    this._content[s] = [...items]
    this._removed[s] = false
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

    const base = this._order ?? this._defaultOrder()
    const moving = base.filter(i => i >= s && i < e)
    const remaining = base.filter(i => i < s || i >= e)
    const insertAt = targetIndex === len
      ? remaining.length
      : remaining.findIndex(i => i === targetIndex)

    this._order = [
      ...remaining.slice(0, insertAt),
      ...moving,
      ...remaining.slice(insertAt),
    ]
    return this
  }

  // -------------------------------------------------------------------------
  // Clone / reset / hasChanged
  // -------------------------------------------------------------------------

  /** Return a deep clone of this MagicArray including all pending edits. */
  clone(): MagicArray<T> {
    const cloned = new MagicArray<T>([...this._original])

    for (let i = 0; i < this._original.length; i++) {
      cloned._content[i] = [...this._content[i]]
      cloned._removed[i] = this._removed[i]
    }
    for (const [owner, boundary] of this._boundaries)
      cloned._boundaries.set(owner, { right: [...boundary.right], left: [...boundary.left] })

    cloned._globalPrepend = [...this._globalPrepend]
    cloned._globalAppend = [...this._globalAppend]
    cloned._tailRight = [...this._tailRight]
    if (this._order !== undefined)
      cloned._order = [...this._order]

    return cloned
  }

  /**
   * Reset all edits, or just those in original [start, end).
   * Resets also clear any pending move order for the affected indices.
   */
  reset(start?: number, end?: number): this {
    if (start === undefined) {
      this._globalPrepend = []
      this._globalAppend = []
      this._tailRight = []
      this._boundaries.clear()
      for (let i = 0; i < this._original.length; i++) {
        this._content[i] = [this._original[i]]
        this._removed[i] = false
      }
      this._order = undefined
    }
    else {
      const [s, e] = this._range(start, end)
      for (let i = s; i < e; i++) {
        this._content[i] = [this._original[i]]
        this._removed[i] = false
        this._boundaries.set(i, { right: [], left: [] })
      }
    }
    return this
  }

  /** Returns true if any edit has been applied (including move). */
  hasChanged(): boolean {
    if (this._order !== undefined)
      return true
    if (this._globalPrepend.length > 0 || this._globalAppend.length > 0)
      return true
    if (this._tailRight.length > 0)
      return true

    for (const boundary of this._boundaries.values()) {
      if (boundary.right.length > 0 || boundary.left.length > 0)
        return true
    }

    for (let i = 0; i < this._original.length; i++) {
      if (this._removed[i])
        return true
      if (this._content[i].length !== 1 || this._content[i][0] !== this._original[i])
        return true
    }
    return false
  }

  // -------------------------------------------------------------------------
  // Slice / snip
  // -------------------------------------------------------------------------

  /**
   * Return the edited sub-array corresponding to original [start, end).
   * Semantics are aligned with magic-string.slice(start, end).
   */
  slice(start: number, end?: number): T[] {
    const [s, e] = this._range(start, end)
    const result: T[] = []

    for (let i = s; i < e; i++) {
      const boundary = this._boundaries.get(i)
      if (boundary !== undefined)
        result.push(...boundary.right)
      if (!this._removed[i])
        result.push(...this._content[i])
      if (boundary !== undefined)
        result.push(...boundary.left)
    }

    return result
  }

  /**
   * Return a clone scoped to original [start, end), matching magic-string.snip().
   */
  snip(start: number, end?: number): MagicArray<T> {
    const [s, e] = this._range(start, end)
    const snipped = this.clone()
    if (e < this._original.length)
      snipped.remove(e, this._original.length)
    if (s > 0)
      snipped.remove(0, s)
    return snipped
  }

  // -------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------

  /** Return the final edited array. */
  toArray(): T[] {
    const result: T[] = []

    result.push(...this._globalPrepend)
    const startBoundary = this._boundaries.get(-1)
    if (startBoundary !== undefined)
      result.push(...startBoundary.left)

    const order = this._order ?? this._defaultOrder()
    for (const i of order) {
      const boundary = this._boundaries.get(i)
      if (boundary !== undefined)
        result.push(...boundary.right)
      if (!this._removed[i])
        result.push(...this._content[i])
      if (boundary !== undefined)
        result.push(...boundary.left)
    }

    result.push(...this._globalAppend)
    result.push(...this._tailRight)
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
    if (index < 0 || index >= this._original.length)
      throw new RangeError(`Index ${index} is out of bounds.`)
    return this._removed[index]
  }
}
