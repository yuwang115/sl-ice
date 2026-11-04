import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Same automatic JSX runtime as the app (tsconfig "jsx": "react-jsx"), so
  // test files do not need an otherwise unused `import React`.
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
