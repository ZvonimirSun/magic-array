# Magic Array

基于**原始索引**操作数组 — 灵感来自 [magic-string](https://github.com/rich-harris/magic-string)。

所有位置参数都指向**原始**数组的索引，而非已变更后的结果。这样在组合多次编辑（例如 AST 遍历）时，无需手动追踪偏移量的变化。

## 安装

```bash
pnpm add @zvonimirsun/magic-array
```

## 快速开始

```ts
import {MagicArray} from '@zvonimirsun/magic-array'

const arr = new MagicArray(['a', 'b', 'c'])

arr.prependLeft(1, '<')   // 在 original[1]（'b'）之前插入 '<'
arr.prependRight(1, '>')  // 在 original[1]（'b'）之后插入 '>'

arr.toArray() // ['a', '<', 'b', '>', 'c']
```

编辑后，索引 `1` 仍然指向 `'b'`：

```ts
arr.remove(0)   // 移除 original[0]（'a'）
arr.toArray()   // ['<', 'b', '>', 'c']
```

## API

所有变更方法均**支持链式调用**（返回 `this`）。

### 全局插入

| 方法                         | 说明          |
|----------------------------|-------------|
| `.prepend(item \| item[])` | 在结果数组最前面插入。 |
| `.append(item \| item[])`  | 在结果数组最后面插入。 |

### 定位插入

以下方法相对于某个原始元素进行插入。"Left" = 元素之前，"Right" = 元素之后。

| 方法                                     | 位置                               |
|----------------------------------------|----------------------------------|
| `.prependLeft(index, item \| item[])`  | `original[index]` 之前 — **最外层**左侧 |
| `.appendLeft(index, item \| item[])`   | `original[index]` 之前 — **最内层**左侧 |
| `.prependRight(index, item \| item[])` | `original[index]` 之后 — **最内层**右侧 |
| `.appendRight(index, item \| item[])`  | `original[index]` 之后 — **最外层**右侧 |

```
prependLeft … appendLeft  [元素]  prependRight … appendRight
```

### 移除

| 方法                     | 说明                                                                |
|------------------------|-------------------------------------------------------------------|
| `.remove(start, end?)` | 移除 `original[start..end)`。`end` 默认为 `start + 1`。同时清除被移除元素的左右插入内容。 |

### 覆盖

| 方法                                         | 说明                                                                                            |
|--------------------------------------------|-----------------------------------------------------------------------------------------------|
| `.overwrite(start, end?, items, options?)` | 用 `items` 替换 `original[start..end)`。默认清除周边的插入内容。传入 `{ contentOnly: true }` 可保留该范围内第一个元素的周边插入。 |

### 移动

| 方法                               | 说明                                                                                               |
|----------------------------------|--------------------------------------------------------------------------------------------------|
| `.move(start, end, targetIndex)` | 将 `original[start..end)` 移动到 `targetIndex` 之前。被移动的元素会携带其左右插入内容。`targetIndex === length` 表示移动到末尾。 |

### 状态与输出

| 方法                     | 说明                                                    |
|------------------------|-------------------------------------------------------|
| `.toArray()`           | 返回最终编辑后的数组。                                           |
| `.toString()`          | 对最终数组执行 `JSON.stringify`。                             |
| `.slice(start, end?)`  | 返回 `original[start..end)` 对应的编辑后子数组。若范围内有元素被移除则抛出异常。  |
| `.snip(start, end?)`   | 克隆并仅保留 `original[start..end)` 的内容。不会携带全局 intro/outro。 |
| `.hasChanged()`        | 是否有过任何编辑（含 move）。                                     |
| `.hasRemoved(index)`   | `original[index]` 是否已被移除。                             |
| `.original(index)`     | 读取原始数组中 `index` 位置的元素。                                |
| `.clone()`             | 深度克隆当前实例（包含所有编辑，相互独立）。                                |
| `.reset(start?, end?)` | 撤销指定范围内的编辑，无参数时撤销全部。同时清理对应的 move 顺序。                  |
| `for...of`             | 通过 `Symbol.iterator` 遍历最终数组。                          |
| `.length`              | **原始**数组的长度。                                          |

## 与 magic-string 对比

| magic-string                         | magic-array                    |
|--------------------------------------|--------------------------------|
| 操作字符串                                | 操作任意类型数组                       |
| `.prependLeft()` / `.appendLeft()`   | 语义一致                           |
| `.prependRight()` / `.appendRight()` | 语义一致                           |
| `.overwrite()`                       | 一致（`contentOnly` 默认保留插入内容）     |
| `.move()`                            | 语义一致                           |
| `.snip()`                            | 语义一致                           |
| `.slice()`                           | 一致（但返回 `T[]` 而非 `MagicString`） |
| `.prepend()` / `.append()`           | 语义一致                           |
| `.trim()` / `.trimLines()`           | 不适用                            |
| `.indent()`                          | 不适用                            |
| `.replace()` / `.replaceAll()`       | 不适用                            |

## License

MIT
