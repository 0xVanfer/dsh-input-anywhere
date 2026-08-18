import { Storage } from 'happy-dom'

// Node 22 exposes a gated global localStorage property. Vitest's happy-dom
// bridge leaves that property untouched, so provide browser storage for tests.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: new Storage(),
  })
}
