import type { ModuleFormat } from 'rolldown'
import type { LibraryFormats } from 'vite'

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import packageJson from './package.json'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function getPackageName() {
  return packageJson.name.replace(/^@[^/]+\//, '')
}

function getPackageNameCamelCase() {
  return getPackageName()
    .replace(/^@[^/]+\//, '') // strip scope
    .replace(/-./g, char => char[1].toUpperCase())
}

const fileName: {
  [key in ModuleFormat]?: string
} = {
  es: `${getPackageName()}.esm.js`,
  cjs: `${getPackageName()}.cjs`,
  iife: `${getPackageName()}.iife.js`,
}

const formats = Object.keys(fileName) as Array<LibraryFormats>

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: './dist',
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: getPackageNameCamelCase(),
      formats,
      fileName: format => fileName[format] || '',
    },
  },
})
