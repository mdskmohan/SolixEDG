import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.PORT) || 5176,
    // Word and Excel drop lock files next to the documents in this folder, and they
    // appear and vanish while they are still held open. Watching one throws EBUSY,
    // which chokidar raises as an unhandled error and takes the dev server down with
    // it — the server was dying mid-session for exactly this reason.
    watch: { ignored: ['**/~$*', '**/*.tmp', '**/dist/**'] },
  },
})
