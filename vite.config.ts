import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';
import fs from 'fs';

function getGitCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return Date.now().toString(36);
  }
}

export default defineConfig(() => {
  const commitHash = getGitCommitHash();
  const buildTime = new Date().toISOString();

  // Garante que a pasta public/ exista com version.json
  try {
    if (!fs.existsSync('public')) {
      fs.mkdirSync('public');
    }
    fs.writeFileSync('public/version.json', JSON.stringify({
      commit: commitHash,
      builtAt: buildTime,
      timestamp: Date.now()
    }, null, 2));
  } catch {
    // Silencioso se não conseguir escrever
  }

  return {
    define: {
      __APP_COMMIT_HASH__: JSON.stringify(commitHash),
      __APP_BUILD_TIME__: JSON.stringify(buildTime),
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      {
        name: 'generate-version-file',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({
              commit: commitHash,
              builtAt: buildTime,
              timestamp: Date.now()
            }, null, 2)
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
