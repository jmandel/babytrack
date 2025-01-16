import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

async function build() {
  // Build the module
  await esbuild.build({
    entryPoints: ['src/lib/WakeWordListener.build.ts'],
    bundle: true,
    outfile: 'public/lib/wakeword.js',
    format: 'esm',
    platform: 'browser',
    sourcemap: true,
    target: ['es2020'],
  });

  // Ensure the file is copied to dist during the main build
  const distDir = path.join('dist', 'lib');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }
  fs.copyFileSync('public/lib/wakeword.js', path.join(distDir, 'wakeword.js'));
  fs.copyFileSync('public/lib/wakeword.js.map', path.join(distDir, 'wakeword.js.map'));

  console.log('WakeWordListener built and copied successfully!');
}

build().catch(console.error); 