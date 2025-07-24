import * as esbuild from 'esbuild'
import pkgJson from './package.json' with { type: 'json' }


await esbuild.build({
  entryPoints: [`${pkgJson.main}`],
  bundle: true,
  minify: false,
  outExtension: { '.js': '.js' },
  outdir: process?.env?.NODE_ENV === "dev" ? '../HighliteDesktop/src/renderer/client/plugins' : 'dist',
  format: 'esm',
  external: ['@babylonjs/core', '@highlite/plugin-api'],
  loader: {
    '.html': 'text',
    '.css': 'text',
    '.png': 'dataurl',
    '.jpg': 'dataurl',
    '.jpeg': 'dataurl',
    '.gif': 'dataurl',
    '.svg': 'dataurl',
    '.webp': 'dataurl',
    '.wav': 'dataurl',
    '.mp3': 'dataurl'
  },
})