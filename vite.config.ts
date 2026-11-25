import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// One id per build: the commit on CI, a timestamp locally. The app compares its own id
// with the deployed version.json to know when an update is available.
const BUILD_ID = (process.env.GITHUB_SHA ?? '').slice(0, 7) || `dev-${Date.now().toString(36)}`;
const BUILD_TIME = new Date().toISOString();

function versionFile(): Plugin {
  return {
    name: 'aphelion-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID, time: BUILD_TIME }) });
    },
  };
}

export default defineConfig({
  plugins: [svelte(), versionFile()],
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
