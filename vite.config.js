import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LEGACY_ENTRY_FILENAMES = [
  'index-C2w_el3E.js',
  'index-CYeILEe7.js',
  'index-DX2NIvLF.js',
  'index-CeprJoRc.js'
];

const LEGACY_STYLE_FILENAMES = [
  'index-CewNYE5j.css',
  'index-BQCcQnzj.css',
  'index-B8hWFdnC.css'
];

function cachedVkAssetCompatibility() {
  return {
    name: 'cached-vk-asset-compatibility',
    apply: 'build',
    generateBundle(_options, bundle) {
      const entryChunk = Object.values(bundle).find((item) => item.type === 'chunk' && item.isEntry);
      const styleAsset = Object.values(bundle).find((item) => item.type === 'asset' && item.fileName.endsWith('.css'));

      if (entryChunk) {
        LEGACY_ENTRY_FILENAMES.forEach((fileName) => {
          this.emitFile({ type: 'asset', fileName: `assets/${fileName}`, source: entryChunk.code });
        });
      }
      if (styleAsset) {
        LEGACY_STYLE_FILENAMES.forEach((fileName) => {
          this.emitFile({ type: 'asset', fileName: `assets/${fileName}`, source: styleAsset.source });
        });
      }
    }
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), cachedVkAssetCompatibility()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => assetInfo.names?.some((name) => name.endsWith('.css'))
          ? 'assets/app.css'
          : 'assets/[name][extname]'
      }
    }
  }
});
