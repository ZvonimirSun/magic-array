# Vite TypeScript 库开发模板

这是一个用于开发 TypeScript 库的 Vite 模板，支持使用 Vue 3 编写调试页面。

## 模板组成

### 核心技术栈

- **构建工具**: [Vite](https://vitejs.dev/) (基于 Rolldown)
- **开发语言**: [TypeScript](https://www.typescriptlang.org/) (~5.9.0)
- **框架支持**: [Vue 3](https://vuejs.org/) (^3.5.22)
- **包管理器**: [pnpm](https://pnpm.io/)

### 开发工具

- **代码质量**:
  - [ESLint](https://eslint.org/) (^9.37.0) - 代码检查
  - [@antfu/eslint-config](https://github.com/antfu/eslint-config) - ESLint 配置
  - [Oxlint](https://oxc.rs/) - 快速代码检查
- **类型生成**: [dts-bundle-generator](https://github.com/timocov/dts-bundle-generator) - 生成 `.d.ts` 类型声明文件
- **样式预处理**: [Sass](https://sass-lang.com/) (^1.93.2)

### 输出格式

该模板配置支持构建多种模块格式:
- **ESM** (ES Modules) - `*.esm.js`
- **CommonJS** - `*.cjs`
- **IIFE** (立即执行函数) - `*.iife.js`

### 项目结构

```
vite-ts-lib-starter/
├── src/              # 库源代码目录
│   └── index.ts      # 库入口文件
├── test/             # 开发测试目录
│   ├── App.vue       # 测试用 Vue 组件
│   └── main.ts       # 测试入口
├── public/           # 静态资源
├── dist/             # 构建输出目录
└── 配置文件
    ├── vite.config.ts                    # Vite 配置
    ├── tsconfig.json                     # TypeScript 配置
    ├── eslint.config.ts                  # ESLint 配置
    └── dts-bundle-generator.config.ts    # 类型声明生成配置
```

## 推荐的 IDE 设置

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (请禁用 Vetur)

## 推荐的浏览器设置

- Chromium 内核浏览器 (Chrome、Edge、Brave 等):
  - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd) 
  - [在 Chrome DevTools 中开启自定义对象格式化](http://bit.ly/object-formatters)
- Firefox:
  - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
  - [在 Firefox DevTools 中开启自定义对象格式化](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## 自定义配置

参考 [Vite 配置文档](https://vitejs.dev/config/)。

## 项目设置

```sh
pnpm install
```

### 开发模式 (热重载)

```sh
pnpm dev
```

### 生产构建 (类型检查、编译和压缩)

```sh
pnpm build
```

构建过程包括:
1. TypeScript 类型检查
2. 使用 Vite 构建库文件 (生成 ESM、CJS、IIFE 格式)
3. 自动生成类型声明文件 (`.d.ts`)

### 代码检查和修复

```sh
pnpm lint
```

该命令会依次运行 Oxlint 和 ESLint 进行代码检查和自动修复。

