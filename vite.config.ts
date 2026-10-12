/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // The guide works in local days. A fixed zone with daylight saving keeps day and
    // midnight tests the same on every machine.
    env: { TZ: 'Europe/Vilnius' },
  },
})
