/// <reference types="vitest/config" />
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'

// Two modes:
//  - default: builds the demo site (index.html) for deployment / `npm run dev`
//  - lib:     builds the embeddable <Noracursion /> component as a library
//
// The lib build emits ESM *and* CJS (the reference package ships ESM only) —
// see CLAUDE.md §5, which asks for both.
export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib'

  return {
    plugins: [
      react(),
      ...(isLib
        ? [
            dts({
              include: ['src'],
              exclude: [
                'src/**/*.test.ts',
                'src/**/*.test.tsx',
                'src/main.tsx',
                'src/App.tsx',
                'src/test',
              ],
              rollupTypes: true,
            }),
          ]
        : []),
    ],
    build: isLib
      ? {
          lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'Noracursion',
            fileName: (format) => (format === 'es' ? 'noracursion.js' : 'noracursion.cjs'),
            formats: ['es', 'cjs'],
          },
          rollupOptions: {
            // react/react-dom are peer deps — keep them external so the
            // consumer's bundler dedupes a single copy.
            external: ['react', 'react-dom', 'react/jsx-runtime'],
            output: {
              globals: {
                react: 'React',
                'react-dom': 'ReactDOM',
              },
            },
          },
        }
      : {},
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})
