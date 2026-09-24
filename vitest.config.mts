import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    // mirror tsconfig's baseUrl so `src/...` imports resolve (used by tests/latex_formatter)
    alias: { src: fileURLToPath(new URL('./src', import.meta.url)) }
  },
  test: {
    fileParallelism: false,
    globalSetup: ['obsidian-integration-testing/vitest-global-setup-plugin']
  }
});
