const config = {
  compilationOptions: {
    preferredConfigPath: './tsconfig.app.json',
  },
  entries: [
    {
      filePath: './src/index.ts',
      outFile: './dist/magic-array.d.ts',
      noCheck: false,
    },
  ],
}

module.exports = config
