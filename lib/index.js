// 论文知识库学习看板 · DeepSeek Harness 插件：宿主半边
// 两件事：① 把看板前端（web/ 目录，构建产物）当成同源静态站点发出去；
//          ② 提供 /paper-board/api/translate，让前端能调 DeepSeek 做整段/全文翻译（密钥不出宿主）。
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-paper-board'
export const inject = ['webServer']

const BASE = '/paper-board'
const HERE = dirname(fileURLToPath(import.meta.url))
const BUILD_TAG = '1.1.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
}

// 静态资源根目录：仓库里的 web/（随包提交）优先，其次本地构建的 dist/
const ROOTS = [join(HERE, '..', 'web'), join(HERE, '..', 'dist')].filter((dir) => existsSync(dir))

function resolveFile(rel) {
  const clean = rel.split('/').filter((p) => p && p !== '.' && p !== '..').join('/')
  for (const root of ROOTS) {
    const base = normalize(root)
    const file = normalize(join(base, clean))
    if (!file.startsWith(base + sep)) continue
    try {
      if (statSync(file).isFile()) return file
    } catch {}
  }
  return null
}

// ── DeepSeek 密钥：只在本机宿主进程里读，浏览器拿不到 ────────────────────────────
let cachedKey = ''
function apiKey() {
  if (cachedKey) return cachedKey
  const candidates = [
    process.env.DEEPSEEK_API_KEY,
    join(process.env.USERPROFILE || '', '.dsh', '.credentials.yaml'),
    join(process.env.HOME || '', '.dsh', '.credentials.yaml'),
  ].filter(Boolean)
  for (const c of candidates) {
    try {
      if (!existsSync(c)) continue
      const m = readFileSync(c, 'utf8').match(/DEEPSEEK_API_KEY:\s*(\S+)/)
      if (m && m[1]) {
        cachedKey = m[1].replace(/^['"]|['"]$/g, '')
        break
      }
    } catch {}
  }
  return cachedKey
}

const SYS_PROMPT = [
  '你是学术论文的专业翻译。把用户给的 JSON 数组里的每一条翻成简体中文。',
  '要求：',
  '1) 只输出一个 JSON 数组，条目数与顺序与输入完全一致，不要输出解释、序号或代码块；',
  '2) 保留原文中的英文术语、缩写、公式、引用编号（如 ADaM、TFL、CDISC、Lora 之类专有名词可保留原名）；',
  '3) 译文要通顺可读的书面语，不要逐词硬译，不要保留英文语序；',
  '4) 原文已经是中文的条目原样返回。',
].join('\n')

const MAX_BATCH_CHARS = 6000
const AI_TIMEOUT_MS = 120000

function packTexts(texts) {
  const groups = []
  let cur = []
  let size = 0
  for (let i = 0; i < texts.length; i++) {
    const len = texts[i].length + 8
    if (cur.length && size + len > MAX_BATCH_CHARS) {
      groups.push(cur)
      cur = []
      size = 0
    }
    cur.push(i)
    size += len
  }
  if (cur.length) groups.push(cur)
  return groups
}

function parseJsonArray(raw) {
  let s = String(raw || '').trim()
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim()
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start >= 0 && end > start) s = s.slice(start, end + 1)
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr.map((x) => String(x ?? '')) : null
  } catch {
    return null
  }
}

async function askDeepSeek(texts, target) {
  const key = apiKey()
  if (!key) throw new Error('宿主没找到 DEEPSEEK_API_KEY')
  const lang = target && target.toLowerCase().startsWith('zh') ? '简体中文' : target || '简体中文'
  const out = new Array(texts.length).fill('')
  for (const group of packTexts(texts)) {
    const payload = group.map((i) => texts[i])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    try {
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model: 'deepseek-chat',
          temperature: 0.2,
          max_tokens: 8000,
          messages: [
            { role: 'system', content: SYS_PROMPT + '\n目标语言：' + lang },
            { role: 'user', content: JSON.stringify(payload) },
          ],
        }),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('DeepSeek HTTP ' + res.status + ' ' + (await res.text()).slice(0, 160))
      const json = await res.json()
      const raw = json?.choices?.[0]?.message?.content || ''
      const arr = parseJsonArray(raw)
      if (!arr || arr.length !== group.length) {
        // 模型没按数组返回：整段退回原文，让前端自己决定要不要换引擎
        throw new Error('AI 返回格式不符（期望 ' + group.length + ' 条，实际 ' + (arr ? arr.length : 0) + ' 条）')
      }
      group.forEach((i, k) => { out[i] = arr[k].trim() })
    } finally {
      clearTimeout(timer)
    }
  }
  return out
}

function json(res, code, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length, 'cache-control': 'no-store' })
  res.end(buf)
}

async function handleApi(req, res, pathname) {
  if (pathname === BASE + '/api/health') {
    return json(res, 200, { ok: true, tag: BUILD_TAG, hasKey: !!apiKey() })
  }
  if (pathname === BASE + '/api/translate') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    let body = {}
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      return json(res, 400, { ok: false, error: 'bad json' })
    }
    const texts = Array.isArray(body.texts) ? body.texts.map((t) => String(t ?? '')) : []
    if (!texts.length) return json(res, 200, { ok: true, texts: [] })
    try {
      const outs = await askDeepSeek(texts, body.target)
      return json(res, 200, { ok: true, texts: outs })
    } catch (err) {
      return json(res, 200, { ok: false, error: String((err && err.message) || err) })
    }
  }
  return json(res, 404, { ok: false, error: 'unknown api' })
}

export function apply(ctx) {
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: BASE,
      handler(req, res) {
        const url = new URL(req.url || '/', 'http://x')
        if (url.pathname.startsWith(BASE + '/api/')) {
          handleApi(req, res, url.pathname).catch((err) => {
            try {
              json(res, 500, { ok: false, error: String(err) })
            } catch {}
          })
          return
        }
        let rel = decodeURIComponent(url.pathname.slice(BASE.length)) || '/'
        if (rel === '/' || rel === '') rel = '/index.html'
        const file = resolveFile(rel.slice(1))
        if (!file) {
          res.writeHead(ROOTS.length === 0 ? 503 : 404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end(ROOTS.length === 0 ? 'paper-board: web root not found (run node build.mjs)' : 'not found')
          return
        }
        const type = MIME[extname(file).toLowerCase()] || 'application/octet-stream'
        res.writeHead(200, { 'content-type': type, 'content-length': statSync(file).size, 'cache-control': 'no-store' })
        if (req.method === 'HEAD') return res.end()
        createReadStream(file).pipe(res)
      },
    }),
  )
}
