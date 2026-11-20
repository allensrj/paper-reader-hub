// 打包：src -> dist（Rollup + Babel，进程内构建，不 spawn 子进程），
// 然后把 dist 同步到 web/ —— web/ 是随仓库提交的产物，别人装插件时不用自己构建。
import { rollup } from 'rollup'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import babel from '@rollup/plugin-babel'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const dist = path.join(root, 'dist')
fs.rmSync(dist, { recursive: true, force: true })
fs.mkdirSync(dist, { recursive: true })

const babelPlugin = babel({
  babelHelpers: 'bundled',
  exclude: /node_modules/,
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  presets: [
    ['@babel/preset-react', { runtime: 'automatic' }],
    ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
  ],
})

const bundle = await rollup({
  input: path.join(root, 'src/main.tsx'),
  plugins: [nodeResolve({ extensions: ['.mjs', '.js', '.json', '.ts', '.tsx'] }), commonjs(), babelPlugin],
  onwarn(w, warn) { if (w.code !== 'CIRCULAR_DEPENDENCY' && w.code !== 'MODULE_LEVEL_DIRECTIVE') warn(w) },
})

const { output } = await bundle.generate({
  format: 'iife',
  inlineDynamicImports: true,
  sourcemap: false,
  name: 'PaperBoard',
  intro: "var process={env:{NODE_ENV:'production'},platform:'browser',browser:true};",
})
await bundle.close()
const js = output.filter(o => o.type === 'chunk').map(o => o.code).join('\n')
fs.writeFileSync(path.join(dist, 'app.js'), js, 'utf8')

const prodHtml = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>论文知识库学习看板</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <pre id="boot-err" style="display:none;white-space:pre-wrap;padding:16px;font:12px/1.5 monospace;color:#a33"></pre>
    <script>
      window.addEventListener('error', function (e) {
        var el = document.getElementById('boot-err');
        if (!el) return;
        el.style.display = 'block';
        el.textContent += 'ERROR: ' + (e.message || '') + '\\n';
      });
    </script>
    <script src="./app.js"></script>
  </body>
</html>
`
fs.writeFileSync(path.join(dist, 'index.html'), prodHtml, 'utf8')
fs.copyFileSync(path.join(root, 'src/styles.css'), path.join(dist, 'styles.css'))

// pdf.js worker 与标准字体：没有它们 PDF 里的西文文字画不出来
const worker = path.join(root, 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs')
if (fs.existsSync(worker)) fs.copyFileSync(worker, path.join(dist, 'pdf.worker.min.mjs'))
const stdFonts = path.join(root, 'node_modules/pdfjs-dist/standard_fonts')
if (fs.existsSync(stdFonts)) fs.cpSync(stdFonts, path.join(dist, 'standard_fonts'), { recursive: true })

// 演示用的真实 PDF（含插图），用来验证原版渲染
for (const name of ['sample-image.pdf', 'sample-doc.pdf']) {
  const src = path.join(root, 'fixtures', name)
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dist, name))
}

// 同步给插件包：宿主半边 /paper-board 就是从 web/ 读文件
const webDir = path.join(root, 'web')
fs.rmSync(webDir, { recursive: true, force: true })
fs.cpSync(dist, webDir, { recursive: true })
console.log('WEB_SYNCED -> ' + webDir)
console.log('BUILD_OK bytes=' + js.length)
