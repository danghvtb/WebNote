import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// A few legacy modules contain UTF-8 bytes that were accidentally decoded as
// Windows-1252 (for example "BÃ¡o"). Repair only tokens with unmistakable
// mojibake markers; valid Vietnamese Unicode elsewhere is left untouched.
function repairMojibake(source: string): string {
  const tokenPattern = /[^\s"'`<>]*(?:Ã.|Â.|â.|ð.|Æ.|Ä.|Å.|á»|áº)[^\s"'`<>]*/g;
  return source.replace(tokenPattern, (token) => {
    try {
      const repaired = Buffer.from(token, 'latin1').toString('utf8');
      return repaired.includes('�') ? token : repaired;
    } catch {
      return token;
    }
  });
}

const legacyTextRepair = {
  name: 'repair-legacy-ui-text',
  enforce: 'pre' as const,
  transform(code: string, id: string) {
    if (!id.includes('/src/') || !/\.[cm]?[jt]sx?$/.test(id)) return null;
    const repaired = repairMojibake(code);
    return repaired === code ? null : { code: repaired, map: null };
  },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    legacyTextRepair,
    react(),
    tailwindcss(),
  ],
  base: './',
  build: {
    rollupOptions: {
      output: {
        // Keep the editor's Tiptap/lowlight runtime out of the route chunk.
        // These modules are only requested when a page is opened.
        manualChunks(id) {
          if (id.includes('node_modules/lowlight') || id.includes('node_modules/highlight.js')) return 'lowlightVendor';
          if (id.includes('node_modules/@tiptap')) return 'tiptapVendor';
          return undefined;
        },
      },
    },
  },
})
