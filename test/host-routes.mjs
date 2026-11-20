// 宿主路由自测：用一个 mock 的 ctx 驱动 lib/index.js，
// 验证同源鉴权、ctx.llm 翻译路径与静态资源分发。
// 运行：node --test test/*.mjs
import { EventEmitter } from 'node:events'
import { Writable } from 'node:stream'
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const mod = await import(join(HERE, '..', 'lib', 'index.js'))

let registered = null
const mockLlm = {
  listProviders: () => [{ id: 'test-provider' }],
  listModels: async () => [{ id: 'test-model' }],
  stream: async function* (options) {
    if (options.provider !== 'test-provider' || options.model !== 'test-model') throw new Error('bad route')
    if (!Array.isArray(options.messages) || options.messages[0].role !== 'user') throw new Error('bad messages')
    if (!options.system || !options.system.includes('JSON')) throw new Error('missing system prompt')
    const payload = JSON.parse(options.messages[0].content[0].text)
    yield { type: 'text-delta', index: 0, text: JSON.stringify(payload.map((t) => '译:' + t)) }
    yield { type: 'finish', reason: { kind: 'stop' } }
  },
}
const services = {
  llm: mockLlm,
  agentDefaultModel: { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) },
}
const ctx = {
  get: (name) => services[name],
  effect: (fn) => fn(),
  webServer: { register: (route) => { registered = route; return () => {} } },
}
mod.apply(ctx)
if (!registered) throw new Error('route not registered')

function call(pathname, { method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter()
    req.method = method
    req.url = pathname
    req.headers = headers
    // 宿主把 node 的 IncomingMessage 交给 handler，它是 async iterable；
    // mock 也必须实现，否则 for await (const chunk of req) 会抛。
    req[Symbol.asyncIterator] = async function* () {
      if (body !== undefined) yield Buffer.from(JSON.stringify(body))
    }
    let status = 0
    const chunks = []
    const res = new Writable({
      write(chunk, enc, cb) { chunks.push(Buffer.from(chunk)); cb() },
      final(cb) { cb() },
    })
    res.writeHead = (code, h) => { status = code; res.headersSent = true }
    res.on('finish', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }))
    res.on('error', reject)
    Promise.resolve(registered.handler(req, res)).catch(reject)
  })
}

const out = []
const check = (name, cond, extra = '') => { out.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); assert.ok(cond, name + (extra ? ' — ' + extra : '')) }

let r = await call('/paper-board/api/health', { headers: { host: '127.0.0.1:3000' } })
check('health 200', r.status === 200)
const health = JSON.parse(r.body)
check('health 报 host-llm + 真实路由', health.engine === 'host-llm' && health.provider === 'test-provider' && health.model === 'test-model', r.body)
check('health hasKey 兼容字段', health.hasKey === true)

r = await call('/paper-board/api/translate', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'sec-fetch-site': 'same-origin' }, body: { texts: ['hello', 'world'], target: 'zh-CN' } })
const tr = JSON.parse(r.body)
check('同源翻译走 ctx.llm', tr.ok === true && tr.texts.length === 2 && tr.texts[0] === '译:hello', r.body)

r = await call('/paper-board/api/translate', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' }, body: { texts: ['x'] } })
check('跨站 403', r.status === 403, r.body)

r = await call('/paper-board/api/translate', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'null' }, body: { texts: ['x'] } })
check('Origin: null 403', r.status === 403)

r = await call('/paper-board/api/translate', { method: 'POST', headers: { host: 'evil.example', origin: 'http://evil.example' }, body: { texts: ['x'] } })
check('DNS 重绑定 403', r.status === 403)

r = await call('/paper-board/api/translate', { method: 'POST', headers: { host: '127.0.0.1:3000' }, body: { texts: ['desktop'] } })
check('无 Origin 放行', JSON.parse(r.body).ok === true, r.body)

r = await call('/paper-board/api/translate', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1' }, body: { texts: ['a'] } })
check('回环无端口 Origin 放行', JSON.parse(r.body).ok === true)

r = await call('/paper-board/api/translate', { method: 'GET', headers: { host: '127.0.0.1:3000' } })
check('GET 405', r.status === 405)

r = await call('/paper-board/index.html', { headers: { host: '127.0.0.1:3000' } })
check('静态 index.html 200', r.status === 200 && r.body.includes('id="root"'), 'status=' + r.status + ' len=' + r.body.length)

r = await call('/paper-board/../../../etc/passwd', { headers: { host: '127.0.0.1:3000' } })
check('路径穿越被挡', r.status === 404 || r.status === 503, 'status=' + r.status)

r = await call('/paper-board/api/nope', { headers: { host: '127.0.0.1:3000' } })
check('未知 api 404', r.status === 404)

test('host routes', () => {})
console.log(out.join('\n'))
