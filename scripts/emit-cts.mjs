// vite-plugin-dts rolls the declarations up to a single `dist/index.d.ts`, which
// Node's `node16`/`nodenext` resolution will not use for the CJS entry — it
// wants a sibling `.d.cts`. The declarations are identical, so copy rather than
// run a second, slower type build.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.d.ts', 'dist/index.d.cts')
