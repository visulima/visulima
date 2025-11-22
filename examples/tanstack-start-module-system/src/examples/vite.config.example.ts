/**
 * Example: Vite configuration with Start modules
 * Shows how to use the module system in a real TanStack Start app
 */

import { defineConfig } from 'vite'
import { startModulePlugin } from '../plugin.js'
import { modules } from './app.config.js'

export default defineConfig({
  plugins: [
    // Add the Start module plugin
    startModulePlugin({
      modules,
      // Optional: specify config file
      // configFile: 'start.config.ts',
    }),
    
    // Other Vite plugins...
  ],

  // Module-specific configuration
  // These are accessed via context.options in modules
  define: {
    // This would be accessed via viteConfig.define in module context
  },
})
