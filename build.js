'use strict';
/**
 * 构建脚本：将 src/ 下的样式与脚本合并进 template.html，产出单文件 index.html
 * 用法：node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'personality-test-app', 'src');
const OUT = path.join(ROOT, 'personality-test-app', 'index.html');

const tpl = fs.readFileSync(path.join(SRC, 'template.html'), 'utf8');
const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');

const jsFiles = ['data-bigfive.js', 'data-resilience.js', 'data-cse.js', 'core.js', 'app.js'];
const js = jsFiles
  .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8'))
  .join('\n');

if (!tpl.includes('/*STYLES*/') || !tpl.includes('/*SCRIPTS*/')) {
  console.error('template.html 缺少注入标记');
  process.exit(1);
}

let html = tpl.replace('/*STYLES*/', () => css).replace('/*SCRIPTS*/', () => js);
fs.writeFileSync(OUT, html, 'utf8');
console.log('build ok:', OUT, html.length, 'bytes');
