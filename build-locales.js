#!/usr/bin/env node
// Build script: minifies every locales/*.js into locales/*.min.js
// Usage: node build-locales.js
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const DIR = path.join(__dirname, 'locales');
const opts = { compress: true, mangle: true, format: { comments: /^!/ } };

(async () => {
  const files = fs.readdirSync(DIR)
    .filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));
  for (const f of files) {
    const src = fs.readFileSync(path.join(DIR, f), 'utf8');
    const out = await minify(src, opts);
    if (out.error) { console.error(f, out.error); process.exitCode = 1; continue; }
    const target = path.join(DIR, f.replace(/\.js$/, '.min.js'));
    fs.writeFileSync(target, out.code);
    process.stdout.write('  built ' + path.relative(__dirname, target) + '\n');
  }
})();
