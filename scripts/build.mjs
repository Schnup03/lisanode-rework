/**
 * Build script - Copy src to dist for production
 */
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const srcDir = join(root, 'src');
const distDir = join(root, 'dist');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Building LisaNode Rework...');

// Copy src to dist
if (existsSync(distDir)) {
  // Clean dist
  for (const entry of readdirSync(distDir)) {
    const p = join(distDir, entry);
    if (statSync(p).isDirectory()) {
      // Remove recursively - simple rmdir for empty dirs
    }
  }
}

mkdirSync(distDir, { recursive: true });
copyDir(srcDir, distDir);

// Copy package.json to dist
copyFileSync(join(root, 'package.json'), join(distDir, 'package.json'));

console.log('✓ Build complete: dist/');
console.log(`  Run with: node dist/sidecar.mjs`);
console.log('');
console.log('Environment variables needed:');
console.log('  GATEWAY_TOKEN  - Your OpenClaw gateway token');
console.log('  GATEWAY_URL   - Gateway WebSocket URL (default: ws://127.0.0.1:18789)');
console.log('  NODE_NAME     - Display name for this node');
