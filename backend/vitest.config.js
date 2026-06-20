const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  envDir: './__tests__',
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    setupFiles: ['./__tests__/helpers/vitest-env.js'],
    include: ['__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['routes/**', 'utils/**', 'middleware/**', 'lib/http.js'],
      exclude: ['node_modules', '__tests__', 'data']
    }
  }
})
