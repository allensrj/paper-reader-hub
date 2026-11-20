// AI 翻译的降级路径自测：模型报错、finish=error、无 llm 服务、无可用模型、
// 默认路由不存在时的回退。运行：node --test test/*.mjs
import { EventEmitter } from 'node:events'
import { Writable } from 'node:stream'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENTRY = join(HERE, '..', 'lib', 'index.js')

async function run(name, services, expect) {
  const mod = await import(ENTRY + '?v=' + encodeURIComponent(name))
  let registered = null
  const ctx = { get: (n) => services[n], effect: (fn) => fn(), webServer: { register: (r) => { registered = r; return () => {} } } }
  mod.apply(ctx)
  const r = await new Promise((resolve, reject) => {
    const req = new EventEmitter()
    req.method = 'POST'; req.url = '/paper-board/api/translate'; req.headers = { host: '127.0.0.1:3000' }
    req[Symbol.asyncIterator] = async function* () { yield Buffer.from(JSON.stringify({ texts: ['a'] })) }
    const chunks = []
    const res = new Writable({ write(c, e, cb) { chunks.push(Buffer.from(c)); cb() }, final(cb) { cb() } })
    res.writeHead = () => {}
    res.on('finish', () => resolve(Buffer.concat(chunks).toString('utf8')))
    res.on('error', reject)
    Promise.resolve(registered.handler(req, res)).catch(reject)
  })
  const ok = expect(r)
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${r}`)
  assert.ok(ok, name + ' — ' + r)
}

// 模型调用抛错（如额度用尽）→ ok:false，前端退回免费引擎
await run('模型报错时返回 ok:false', {
  llm: { listProviders: () => [{ id: 'p' }], listModels: async () => [{ id: 'm' }], stream: async function* () { throw new Error('quota exceeded') } },
  agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) },
}, (r) => { const j = JSON.parse(r); return j.ok === false && /quota/.test(j.error) })

// finish 是 error chunk → 同样 ok:false
await run('finish=error 时返回 ok:false', {
  llm: { listProviders: () => [{ id: 'p' }], listModels: async () => [{ id: 'm' }], stream: async function* () { yield { type: 'finish', reason: { kind: 'error', failure: { message: 'auth failed', code: 'AUTH' } } } } },
  agentDefaultModel: { currentSelection: () => ({ provider: 'p', model: 'm' }) },
}, (r) => { const j = JSON.parse(r); return j.ok === false && /auth failed/.test(j.error) })

// 完全没有 llm 服务
await run('无 llm 服务时 ok:false', {}, (r) => JSON.parse(r).ok === false)

// 有 llm 但没模型
await run('无可用模型时 ok:false', {
  llm: { listProviders: () => [], listModels: async () => [], stream: async function* () {} },
  agentDefaultModel: { currentSelection: () => null },
}, (r) => JSON.parse(r).ok === false)

// 默认模型指向未注册的 provider → 应回退到已注册的
await run('默认模型路由不存在时回退', {
  llm: { listProviders: () => [{ id: 'real' }], listModels: async () => [{ id: 'real-model' }], stream: async function* (o) { yield { type: 'text-delta', index: 0, text: JSON.stringify(o.model === 'real-model' ? ['OK'] : ['BAD']) }; yield { type: 'finish', reason: { kind: 'stop' } } } },
  agentDefaultModel: { currentSelection: () => ({ provider: 'ghost', model: 'nope' }) },
}, (r) => { const j = JSON.parse(r); return j.ok === true && j.texts[0] === 'OK' && j.provider === 'real' })
