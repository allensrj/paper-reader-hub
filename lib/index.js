// 论文知识库学习看板 · DeepSeek Harness 插件：宿主半边
// 两件事：① 把看板前端（web/ 目录，构建产物）当成同源静态站点发出去；
//          ② 提供 /paper-board/api/translate，用本机 DSH 当前选中的模型做整段/全文翻译。
//
// AI 翻译走的是宿主自己的 llm 服务（ctx.llm）：
//   - 模型与凭证都来自你已经在用的 DSH 配置，插件不另配 key、不写死模型名；
//   - 模型没配好 / 服务不可用时返回 ok:false，前端自动退回 Google → 有道 → MyMemory → 本地词典。
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-paper-board'
export const inject = ['webServer']

const BASE = '/paper-board'
const HERE = dirname(fileURLToPath(import.meta.url))
const BUILD_TAG = '1.2.0'

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

// ── 同源鉴权 ────────────────────────────────────────────────────────────────
// 这些路由由本机 DSH 的 HTTP 服务发出，能改状态、也花用户的钱（一次翻译就是一次模型调用），
// 所以只接受「同源请求」：别的网页在用户浏览器里发出的跨站请求会被拒掉。
//
// 规则与 dsh-market 的 sameOrigin 保持一致，因为踩过的坑一样：
//   · Host 是 DNS 重绑定攻击唯一伪造不了的头，所以 Host 必须是本机回环地址；
//   · Origin 缺失不算跨站——浏览器对同源 POST 也会带 Origin，不带说明调用方不是网页
//     （桌面端的代理会剥掉 Origin / Host，按缺失拒绝会误伤整条链路）；
//   · Origin: null（沙箱 iframe、data: 文档）是「存在但不可解析」，必须拒绝；
//   · Chrome 151+ 在回环地址上会省掉端口，所以回环 Host 接受同主机名但无端口的 Origin。
function hostnameOf(host) {
  const lower = String(host).toLowerCase()
  if (lower.startsWith('[')) {
    const end = lower.indexOf(']')
    return end === -1 ? lower : lower.slice(0, end + 1)
  }
  return lower.split(':')[0]
}

function isLoopbackAuthority(host) {
  if (host === undefined) return false
  const name = hostnameOf(host)
  return name === '127.0.0.1' || name === 'localhost' || name === '[::1]' || name === '::1'
}

function sameOrigin(req) {
  if (req.headers['sec-fetch-site'] === 'cross-site') return false
  const host = req.headers.host
  // Host 在就必须是本机回环；不在（被代理剥掉）时下面的 Origin 比对仍然生效。
  if (host !== undefined && !isLoopbackAuthority(host)) return false
  const origin = req.headers.origin
  // 没有 Origin 说明调用方不是网页，浏览器对同源 POST 一定带 Origin。
  if (origin === undefined) return true
  let url
  try {
    url = new URL(origin)
  } catch {
    return false // 含 Origin: null
  }
  if (host === undefined) return false
  if (url.host === host) return true
  // Chrome 151+ 在回环地址上省端口：主机名一致就放行。
  if (url.port === '' && isLoopbackAuthority(host)) return url.hostname === hostnameOf(host)
  return false
}

// ── 翻译：走宿主 llm 服务，用用户当前选中的模型 ──────────────────────────────
const SYS_PROMPT = [
  '你是学术论文的专业翻译。把用户给的 JSON 数组里的每一条翻成简体中文。',
  '要求：',
  '1) 只输出一个 JSON 数组，条目数与顺序与输入完全一致，不要输出解释、序号或代码块；',
  '2) 保留原文中的英文术语、缩写、公式、引用编号（如 ADaM、TFL、CDISC、Lora 之类专有名词可保留原名）；',
  '3) 译文要通顺可读的书面语，不要逐词硬译，不要保留英文语序；',
  '4) 原文已经是中文的条目原样返回。',
].join('\n')

/** 一批塞多少字符：模型默认输出上限通常 4k token，3000 字符原文翻完不会顶到天花板。 */
const MAX_BATCH_CHARS = 3000
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
  s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
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

/** 已注册的 provider 路由 id 列表。 */
function providerIds(llm) {
  try {
    return (llm.listProviders() || [])
      .map((entry) => (typeof entry === 'string' ? entry : entry && entry.id))
      .filter(Boolean)
  } catch {
    return []
  }
}

/**
 * 解析这次要用的 provider/model。
 *
 * 优先用 DSH 的默认模型（就是用户在设置里选的那个，agentDefaultModel 服务），
 * 其次退回宿主已注册的第一个带模型的 provider。两者都没有时返回 null，
 * 前端据此退回免费引擎。
 */
async function resolveRoute(ctx, llm) {
  const registered = providerIds(llm)
  if (!registered.length) return null
  try {
    const selection = ctx.get('agentDefaultModel', false)?.currentSelection?.()
    if (selection && selection.provider && selection.model && registered.includes(selection.provider)) {
      return { provider: selection.provider, model: selection.model }
    }
  } catch {}
  for (const provider of registered) {
    let models = []
    try {
      models = (await llm.listModels(provider)) || []
    } catch {
      continue
    }
    for (const model of models) {
      const id = typeof model === 'string' ? model : model && model.id
      if (id) return { provider, model: id }
    }
  }
  return null
}

/** 把一次模型调用收成纯文本；终止原因是 error/aborted 时抛出真实原因。 */
async function collectText(llm, options) {
  let text = ''
  let finish
  for await (const chunk of llm.stream(options)) {
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'finish') finish = chunk.reason
  }
  const kind = finish && finish.kind
  if (kind === 'error' || kind === 'aborted') {
    const failure = finish.failure || {}
    throw new Error(failure.message || failure.code || '模型调用失败')
  }
  if (kind === 'max-tokens') throw new Error('模型输出达到上限，本批译文不完整')
  return text
}

async function askHostModel(llm, route, texts, target) {
  const lang = target && String(target).toLowerCase().startsWith('zh') ? '简体中文' : target || '简体中文'
  const system = SYS_PROMPT + '\n目标语言：' + lang
  const out = new Array(texts.length).fill('')
  for (const group of packTexts(texts)) {
    const payload = group.map((i) => texts[i])
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
    try {
      const options = {
        provider: route.provider,
        model: route.model,
        system,
        messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify(payload) }] }],
        signal: controller.signal,
      }
      const raw = await collectText(llm, options)
      const arr = parseJsonArray(raw)
      if (!arr || arr.length !== group.length) {
        throw new Error(
          'AI 返回格式不符（期望 ' + group.length + ' 条，实际 ' + (arr ? arr.length : 0) + ' 条）',
        )
      }
      group.forEach((i, k) => {
        out[i] = arr[k].trim()
      })
    } finally {
      clearTimeout(timer)
    }
  }
  return out
}

function json(res, code, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': buf.length,
    'cache-control': 'no-store',
  })
  res.end(buf)
}

function forbidden(res) {
  json(res, 403, { ok: false, error: 'cross-origin request refused' })
}

async function handleApi(req, res, pathname, ctx) {
  if (pathname === BASE + '/api/health') {
    const llm = ctx.get('llm', false)
    const route = llm ? await resolveRoute(ctx, llm) : null
    return json(res, 200, {
      ok: true,
      tag: BUILD_TAG,
      // hasKey 保留旧字段名：它现在的含义是「宿主能用当前模型做翻译」，不再是「读到了某个 key」。
      hasKey: route !== null,
      engine: route ? 'host-llm' : 'none',
      provider: route ? route.provider : null,
      model: route ? route.model : null,
    })
  }

  if (pathname === BASE + '/api/translate') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'method not allowed' })
    // 一次翻译就是一次真实的模型调用（花用户的钱），跨站请求一律拒绝。
    if (!sameOrigin(req)) return forbidden(res)
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > 4 * 1024 * 1024) return json(res, 413, { ok: false, error: 'payload too large' })
      chunks.push(chunk)
    }
    let body = {}
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      return json(res, 400, { ok: false, error: 'bad json' })
    }
    const texts = Array.isArray(body.texts) ? body.texts.map((t) => String(t ?? '')) : []
    if (!texts.length) return json(res, 200, { ok: true, texts: [] })
    const llm = ctx.get('llm', false)
    if (!llm) return json(res, 200, { ok: false, error: '宿主没有 llm 服务，AI 翻译不可用' })
    const route = await resolveRoute(ctx, llm)
    if (!route) return json(res, 200, { ok: false, error: '宿主没有可用的模型，AI 翻译不可用' })
    try {
      const outs = await askHostModel(llm, route, texts, body.target)
      return json(res, 200, { ok: true, texts: outs, provider: route.provider, model: route.model })
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
        let url
        try {
          url = new URL(req.url || '/', 'http://x')
        } catch {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('bad request')
          return
        }
        // 前缀路由理论上只会收到 BASE 开头的路径；万一收到别的，直接 404，
        // 而不是把 '/../../etc/passwd' 这类路径送进静态文件解析。
        if (url.pathname !== BASE && !url.pathname.startsWith(BASE + '/')) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('not found')
          return
        }
        if (url.pathname.startsWith(BASE + '/api/')) {
          handleApi(req, res, url.pathname, ctx).catch((err) => {
            try {
              json(res, 500, { ok: false, error: String(err) })
            } catch {}
          })
          return
        }
        let rel
        try {
          rel = decodeURIComponent(url.pathname.slice(BASE.length)) || '/'
        } catch {
          res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('bad path')
          return
        }
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
