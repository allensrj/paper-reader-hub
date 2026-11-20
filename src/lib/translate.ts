import type { TranslationSettings } from '../types'

const DICT: Record<string, string> = {
  paper: '论文', model: '模型', models: '模型', learning: '学习', deep: '深度', neural: '神经',
  network: '网络', networks: '网络', attention: '注意力', transformer: '变换器', data: '数据',
  training: '训练', dataset: '数据集', results: '结果', method: '方法', methods: '方法',
  experiment: '实验', experiments: '实验', performance: '性能', accuracy: '准确率',
  language: '语言', vision: '视觉', image: '图像', images: '图像', text: '文本',
  knowledge: '知识', graph: '图', representation: '表示', representations: '表示',
  feature: '特征', features: '特征', layer: '层', layers: '层', token: '词元',
  tokens: '词元', encoder: '编码器', decoder: '解码器', embedding: '嵌入',
  task: '任务', tasks: '任务', benchmark: '基准', state: '状态', art: '技术',
  'state-of-the-art': '最先进的', approach: '方法', framework: '框架', architecture: '架构',
  proposed: '提出的', propose: '提出', show: '表明', shows: '表明', shown: '表明',
  demonstrate: '证明', improve: '提升', improves: '提升', improved: '提升',
  significant: '显著的', significantly: '显著地', outperform: '优于', baseline: '基线',
  we: '我们', our: '我们的', this: '这个', these: '这些', is: '是', are: '是', the: '',
  a: '', an: '', of: '的', in: '在', on: '关于', for: '用于', with: '与', by: '通过',
  and: '和', or: '或', to: '到', from: '来自', that: '那个', which: '其', as: '作为',
  study: '研究', studies: '研究', analysis: '分析', result: '结果', large: '大型',
  small: '小型', new: '新的', novel: '新颖的', existing: '现有的', general: '通用的',
  specific: '特定的', high: '高', low: '低', better: '更好的', best: '最好的',
  human: '人类', machine: '机器', translation: '翻译', generation: '生成',
  classification: '分类', detection: '检测', segmentation: '分割', recognition: '识别',
  retrieval: '检索', 'retrieval-augmented': '检索增强的', prompt: '提示', prompts: '提示',
  'fine-tuning': '微调', pretraining: '预训练', pretrained: '预训练的', parameter: '参数',
  parameters: '参数', scaling: '扩展', efficiency: '效率', efficient: '高效的',
  robustness: '鲁棒性', generalization: '泛化', transfer: '迁移', domain: '领域',
  domains: '领域', question: '问题', answering: '回答', reasoning: '推理', context: '上下文',
  long: '长', short: '短', sequence: '序列', memory: '记忆', retrieval: '检索',
  semantic: '语义', syntax: '句法', grammar: '语法', sentence: '句子', sentences: '句子',
  word: '词', words: '词', document: '文档', documents: '文档', corpus: '语料库',
  evaluation: '评估', metric: '指标', metrics: '指标', loss: '损失', gradient: '梯度',
  optimization: '优化', objective: '目标', function: '函数', probability: '概率',
  distribution: '分布', inference: '推理', latency: '延迟', throughput: '吞吐量',
  compute: '算力', gpu: '图形处理器', memory: '内存', storage: '存储', retrieval: '检索',
  multimodal: '多模态', modality: '模态', speech: '语音', audio: '音频', video: '视频',
  medical: '医学的', clinical: '临床的', biology: '生物学', physics: '物理学',
  chemistry: '化学', math: '数学', code: '代码', programming: '编程', software: '软件',
  safety: '安全性', alignment: '对齐', bias: '偏差', fairness: '公平性',
  privacy: '隐私', security: '安全', attack: '攻击', defense: '防御',
  reinforcement: '强化', reward: '奖励', policy: '策略', agent: '智能体', agents: '智能体',
  planning: '规划', tool: '工具', tools: '工具', environment: '环境', simulation: '仿真',
  real: '真实', world: '世界', time: '时间', series: '序列', forecasting: '预测',
  prediction: '预测', regression: '回归', clustering: '聚类', unsupervised: '无监督的',
  supervised: '有监督的', semi: '半', zero: '零', few: '少', shot: '样本', shots: '样本',
  instruction: '指令', instructions: '指令', feedback: '反馈', preference: '偏好',
  optimization: '优化', distillation: '蒸馏', quantization: '量化', pruning: '剪枝',
  mixture: '混合', experts: '专家', sparse: '稀疏的', dense: '稠密的', routing: '路由',
  chunk: '块', chunks: '块', index: '索引', document: '文档', passage: '段落',
  query: '查询', queries: '查询', relevance: '相关性', entity: '实体', relation: '关系',
  triple: '三元组', ontology: '本体', schema: '模式', label: '标签', labels: '标签',
  annotation: '标注', annotator: '标注者', inter: '相互', agreement: '一致性',
}

const PHRASES: Array<[RegExp, string]> = [
  [/\bstate[- ]of[- ]the[- ]art\b/gi, '最先进的'],
  [/\bwe propose\b/gi, '我们提出'],
  [/\bwe present\b/gi, '我们提出'],
  [/\bwe show that\b/gi, '我们表明'],
  [/\bwe find that\b/gi, '我们发现'],
  [/\bin this paper\b/gi, '在本文中'],
  [/\bexperimental results\b/gi, '实验结果'],
  [/\blarge language model(s)?\b/gi, '大语言模型'],
  [/\bdeep learning\b/gi, '深度学习'],
  [/\bneural network(s)?\b/gi, '神经网络'],
  [/\bnatural language processing\b/gi, '自然语言处理'],
  [/\bcomputer vision\b/gi, '计算机视觉'],
  [/\bmachine learning\b/gi, '机器学习'],
  [/\bknowledge graph(s)?\b/gi, '知识图谱'],
  [/\breinforcement learning\b/gi, '强化学习'],
  [/\bfine[- ]tun(e|ing)\b/gi, '微调'],
  [/\bzero[- ]shot\b/gi, '零样本'],
  [/\bfew[- ]shot\b/gi, '少样本'],
  [/\bf1[- ]score\b/gi, 'F1 分数'],
  [/\bperformance\b/gi, '性能'],
]

export function localTranslate(text: string): string {
  if (!text.trim()) return ''
  let out = text
  for (const [re, zh] of PHRASES) out = out.replace(re, zh)
  const words = out.split(/(\s+)/)
  const mapped = words.map((w) => {
    if (/^\s+$/.test(w) || !w) return w
    const clean = w.replace(/[^A-Za-z-]/g, '')
    if (!clean) return w
    const key = clean.toLowerCase()
    const zh = DICT[key]
    if (zh === undefined) return w
    return w.replace(clean, zh)
  })
  let joined = mapped.join('')
  joined = joined.replace(/\s+([，。、；：）】」])/g, '\$1').replace(/([（【「])\s+/g, '\$1')
  joined = joined.replace(/\s{2,}/g, ' ').trim()
  return '〔本地词典〕' + joined
}

function isChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

/** 目标语言代码：中文统一成 zh-CN，其它原样透传 */
function normTarget(target: string): string {
  const t = (target || 'zh-CN').trim()
  return t.toLowerCase().startsWith('zh') ? 'zh-CN' : t
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function timeoutSignal(ms: number): any {
  try {
    const AS: any = AbortSignal as any
    return typeof AS?.timeout === 'function' ? AS.timeout(ms) : undefined
  } catch (e) {
    return undefined
  }
}

/**
 * 在线接口对单次请求长度有硬限制（MyMemory 500 字符），按句子边界切块。
 * 以前整段直接 slice(0, 500) 交给接口，超出的半段被悄悄丢掉，译文就只剩前半句。
 */
export function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text]
  const out: string[] = []
  let cur = ''
  const flush = () => {
    if (cur.trim()) out.push(cur.trim())
    cur = ''
  }
  const sentences = text.split(/(?<=[.!?;:])\s+/)
  for (const raw of sentences) {
    let sentence = raw
    if (sentence.length > limit) {
      flush()
      // 一句话就超长（没有标点的长串），只能按空格硬切
      while (sentence.length > limit) {
        let cut = sentence.lastIndexOf(' ', limit)
        if (cut < Math.floor(limit * 0.5)) cut = limit
        out.push(sentence.slice(0, cut).trim())
        sentence = sentence.slice(cut).trim()
      }
      if (sentence) cur = sentence
      continue
    }
    const next = cur ? cur + ' ' + sentence : sentence
    if (next.length > limit) flush()
    cur = cur ? cur + ' ' + sentence : sentence
  }
  flush()
  return out.length ? out : [text]
}

/** 失败退避重试：在线接口偶发限流 / 返回 HTML 错误页，等一下再试通常就恢复 */
async function withRetry<T>(fn: () => Promise<T>, attempts: number, baseDelay: number): Promise<T> {
  let lastErr: any = null
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn()
    } catch (e) {
      lastErr = e
      if (i < attempts) await sleep(baseDelay * Math.pow(2, i))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/** Google 翻译（免费 gtx 接口）：长文本走 POST，质量与长度都比 MyMemory 宽松 */
async function googleChunk(text: string, target: string): Promise<string> {
  const params = new URLSearchParams()
  params.set('client', 'gtx')
  params.set('sl', 'auto')
  params.set('tl', normTarget(target))
  params.set('dt', 't')
  params.set('q', text)
  const res = await fetch('https://translate.googleapis.com/translate_a/single', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: params.toString(),
    signal: timeoutSignal(15000),
  })
  const raw = await res.text()
  let json: any = null
  try {
    json = JSON.parse(raw)
  } catch (e) {
    // 限流时接口直接吐一段 HTML，解析失败就等于本次请求失败，交给上层退避重试
    throw new Error('Google 翻译返回异常（HTTP ' + res.status + '）')
  }
  const segs = json?.[0]
  if (!Array.isArray(segs)) throw new Error('Google 翻译返回格式异常')
  const out = segs.map((seg: any) => (seg && typeof seg[0] === 'string' ? seg[0] : '')).join('')
  if (!out.trim()) throw new Error('Google 翻译无返回')
  return out
}

async function googleTranslate(text: string, target: string): Promise<string> {
  const chunks = chunkText(text, 4000)
  const parts: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    parts.push(await withRetry(() => googleChunk(chunks[i], target), 2, 600))
    if (i < chunks.length - 1) await sleep(120)
  }
  return parts.join(' ')
}

/** MyMemory 免费接口：单次上限 500 字符，超了它会报错而不是截断 */
async function myMemoryChunk(text: string, target: string): Promise<string> {
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text) +
    '&langpair=en|' +
    encodeURIComponent(normTarget(target))
  const res = await fetch(url, { signal: timeoutSignal(15000) })
  let json: any = null
  try {
    json = await res.json()
  } catch (e) {
    throw new Error('MyMemory 返回异常（HTTP ' + res.status + '）')
  }
  const status = Number(json?.responseStatus ?? res.status)
  const detail = String(json?.responseDetails ?? '').trim()
  // 免费额度用满是 429 + "YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY"，这不是译文
  if (status !== 200) throw new Error(detail || 'MyMemory HTTP ' + res.status)
  const out = json?.responseData?.translatedText
  if (!out || typeof out !== 'string' || !out.trim()) throw new Error(detail || 'MyMemory 无返回')
  return out
}

async function myMemory(text: string, target: string): Promise<string> {
  const chunks = chunkText(text, 480)
  const parts: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    parts.push(await withRetry(() => myMemoryChunk(chunks[i], target), 1, 500))
    if (i < chunks.length - 1) await sleep(150)
  }
  return parts.join(' ')
}

/** 有道智云 demo 接口：CORS 开放，长句质量稳定，单次上限约 1000 字符 */
async function youdaoChunk(text: string, target: string): Promise<string> {
  const tl = normTarget(target).toLowerCase().startsWith('zh') ? 'zh-CHS' : normTarget(target)
  const url =
    'https://aidemo.youdao.com/trans?q=' +
    encodeURIComponent(text) +
    '&from=en&to=' +
    encodeURIComponent(tl)
  const res = await fetch(url, { signal: timeoutSignal(15000) })
  let json: any = null
  try {
    json = await res.json()
  } catch (e) {
    throw new Error('有道翻译返回异常（HTTP ' + res.status + '）')
  }
  const code = Number(json?.errorCode ?? res.status)
  // errorCode 411 是访问频率超限，103 是长度超限，都不是译文
  if (code !== 0) throw new Error('有道翻译错误码 ' + code)
  // 短句返回字符串，长句返回字符串数组，两种都得接住。
  // 批量翻译时靠换行分段，所以拼数组时也要用换行，不能用空格把它们糊成一行
  const raw = json?.translation
  const sep = text.includes('\n') ? '\n' : ' '
  const out = Array.isArray(raw) ? raw.join(sep) : typeof raw === 'string' ? raw : ''
  if (!out.trim()) throw new Error('有道翻译无返回')
  return out.trim()
}

async function youdaoTranslate(text: string, target: string): Promise<string> {
  const chunks = chunkText(text, 900)
  const parts: string[] = []
  for (let i = 0; i < chunks.length; i++) {
    parts.push(await withRetry(() => youdaoChunk(chunks[i], target), 1, 500))
    if (i < chunks.length - 1) await sleep(150)
  }
  return parts.join(' ')
}

/**
 * AI 翻译：走 DSH 宿主半边的同源接口 /paper-board/api/translate。
 * 宿主用你已经在用的 DSH 模型（ctx.llm + 设置里选的那个）去翻，
 * 插件不另配 key、也不写死模型名。这是质量最好、也几乎不限流的一条路，
 * 只有宿主不可用（例如单独用 serve.cjs 调试）时才会落到下面几个免费引擎。
 */
const AI_ENDPOINT = 'api/translate'

async function aiPost(lines: string[], target: string): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: lines, target }),
      signal: timeoutSignal(120000),
    })
  } catch (e) {
    throw new Error('AI 翻译接口不可达（' + brief(e) + '）')
  }
  let json: any = null
  try {
    json = await res.json()
  } catch (e) {
    throw new Error('AI 翻译返回异常（HTTP ' + res.status + '，非 JSON，可能宿主插件未启用）')
  }
  if (!json || json.ok !== true) throw new Error('AI 翻译失败：' + String(json?.error || 'HTTP ' + res.status))
  const out = json.texts
  if (!Array.isArray(out) || out.length !== lines.length) throw new Error('AI 翻译条目数不符')
  return out.map((s: any) => (typeof s === 'string' ? s : ''))
}

/**
 * 批量路径复用它：上层已经把多段用换行拼成一个字符串发进来，
 * 这里再按行拆回数组，让 AI 一次翻多段并保持一一对应。
 */
async function aiTranslate(joined: string, target: string): Promise<string> {
  const lines = joined.split('\n')
  const out = await aiPost(lines, target)
  return out.join('\n')
}

async function customEndpoint(url: string, text: string, target: string): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, target }),
  })
  if (!res.ok) throw new Error('自定义接口 HTTP ' + res.status)
  const json = await res.json()
  const out = json?.translation || json?.translatedText || json?.result || json?.data
  if (!out) throw new Error('自定义接口无返回字段')
  return String(out)
}

export interface TranslateOutcome {
  text: string
  engine: string
  warning?: string
}

/**
 * 引擎冷却表：免费接口一旦限流（429 / 错误码 411），短时间内每一次请求都会失败。
 * 不记下来的话，整篇翻译里每一段都要先白等一轮退避重试，全文翻译会慢得离谱。
 */
const engineDownUntil: Record<string, number> = {}
const ENGINE_COOLDOWN_MS = 120000

function engineAvailable(name: string): boolean {
  const until = engineDownUntil[name]
  return !until || Date.now() >= until
}

/** 给设置面板/调试用：清空冷却，让下一段重新试所有引擎 */
export function resetEngineCooldown(): void {
  for (const key of Object.keys(engineDownUntil)) delete engineDownUntil[key]
}

/**
 * 本地词典兜底的硬条件：整段里每个词都得能查到。
 * 词典没有语法，只要有一个词查不到，拼出来就是
 * 「注意力 是 All You Need」这种半中半英的碎片，比保留原文更难读。
 */
const LOCAL_FALLBACK_MAX = 60

function fullyCovered(text: string): boolean {
  const tokens = text
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^a-z-]/g, ''))
    .filter(Boolean)
  if (!tokens.length) return false
  return tokens.every((t) => typeof DICT[t] === 'string' && DICT[t].length > 0)
}

function brief(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.length > 120 ? msg.slice(0, 120) + '…' : msg
}

/** 在线引擎全部失手时的兜底：短词短句用词典对照，长段落保留原文并如实告警 */
function offlineFallback(trimmed: string, reason: string): TranslateOutcome {
  if (trimmed.length > LOCAL_FALLBACK_MAX || !fullyCovered(trimmed)) {
    return {
      text: trimmed,
      engine: '原文',
      warning: '在线翻译暂时不可用（' + reason + '），这一段先保留原文，稍后重新点一次翻译即可重试',
    }
  }
  return {
    text: localTranslate(trimmed),
    engine: '本地词典',
    warning: '在线翻译暂时不可用（' + reason + '），下面是本地词典的逐词对照，语法不可靠，仅供参考',
  }
}

/**
 * 引擎顺序：Google（免费 gtx）→ 有道（demo 接口）→ MyMemory → 仅短词用本地词典。
 * 以前只挂 MyMemory，额度一用完就静默退回逐词拼接，整段译文看起来像崩了；
 * 现在任一引擎失败都会继续试下一个，最终失败也带回 warning 让界面说明原因。
 * 三个免费接口都会限流，多个引擎只是把「整段崩掉」变成「偶尔一段回原文」。
 */
export async function translateText(text: string, settings: TranslationSettings): Promise<TranslateOutcome> {
  const trimmed = text.trim()
  if (!trimmed) return { text: '', engine: 'none' }
  if (isChinese(trimmed)) return { text: trimmed, engine: 'passthrough' }

  const provider = settings.provider
  if (provider === 'local') return { text: localTranslate(trimmed), engine: '本地词典' }

  if (provider === 'custom' && settings.customUrl.trim()) {
    try {
      return { text: await customEndpoint(settings.customUrl.trim(), trimmed, settings.target), engine: '自定义接口' }
    } catch (e) {
      return offlineFallback(trimmed, '自定义接口失败：' + brief(e))
    }
  }

  // AI 放在最前面：质量最好、几乎不限流，失败（例如单独用 serve.cjs 调试没有宿主）才落到免费引擎
  const order: string[] =
    provider === 'mymemory' ? ['MyMemory', 'Google', '有道'] : ['AI', 'Google', '有道', 'MyMemory']
  const failures: string[] = []
  // 冷却中的引擎先跳过；万一全都在冷却，就照原顺序再试一遍，免得彻底没得用
  const live = order.filter(engineAvailable)
  const plan = live.length ? live : order
  for (const engine of plan) {
    try {
      const out =
        engine === 'AI'
          ? await aiTranslate(trimmed, settings.target)
          : engine === 'Google'
            ? await googleTranslate(trimmed, settings.target)
            : engine === '有道'
              ? await youdaoTranslate(trimmed, settings.target)
              : await myMemory(trimmed, settings.target)
      return {
        text: out,
        engine,
        warning: failures.length ? failures.join('；') + '，已自动改用 ' + engine : undefined,
      }
    } catch (e) {
      engineDownUntil[engine] = Date.now() + ENGINE_COOLDOWN_MS
      failures.push(engine + ' 失败：' + brief(e))
    }
  }
  return offlineFallback(trimmed, failures.join('；'))
}

/**
 * 单次请求能塞多少字符：有道 demo 接口实测 900 上下安全，超过返回错误码 103；
 * AI 走宿主那边 6000 字符一包（宿主内部还会再按自己上限装箱），一段一次非常快。
 */
const BATCH_LIMIT: Record<string, number> = { AI: 6000, Google: 3500, 有道: 900, MyMemory: 450 }

/** 把多段文字拼成尽量少的批次，段之间用换行分隔（接口会保留换行，能按行切回来） */
function packBatches(lines: string[], limit: number): number[][] {
  const groups: number[][] = []
  let cur: number[] = []
  let size = 0
  for (let i = 0; i < lines.length; i++) {
    const len = lines[i].length + 1
    if (cur.length && size + len > limit) {
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

/** 有道 411 / Google 429 这类都是「发太快了」，歇一会儿还能继续，不该当致命错误 */
const RATE_LIMIT_BACKOFF_MS = 12000
// 撞限流后最多再退 RATE_LIMIT_RETRIES 轮（12s → 20s），退完仍失败才落到下一个引擎
const RATE_LIMIT_RETRIES = 2

/**
 * 每个引擎的自适应节奏。免费接口不是匀速限流，是「连发几次就被关一会儿」，
 * 撞过一次就主动放慢，后面就不用反复撞墙重来——整篇反而更快翻完。
 */
const enginePace: Record<string, number> = {}
const DEFAULT_PACE: Record<string, number> = { AI: 0, Google: 250, 有道: 1800, MyMemory: 400 }

function paceOf(engine: string): number {
  return enginePace[engine] ?? DEFAULT_PACE[engine] ?? 500
}

/** 撞限流后放慢一档，最多 5 秒一次，再慢就没意义了 */
function slowDown(engine: string): void {
  enginePace[engine] = Math.min(5000, Math.round(paceOf(engine) * 1.6))
}

function isRateLimit(msg: string): boolean {
  return /411|429|频率|too many|rate/i.test(msg)
}

function engineCall(engine: string, text: string, target: string): Promise<string> {
  if (engine === 'AI') return aiTranslate(text, target)
  if (engine === 'Google') return googleChunk(text, target)
  if (engine === '有道') return youdaoChunk(text, target)
  return myMemoryChunk(text, target)
}

/**
 * 段落批量翻译：免费接口真正的瓶颈是「每分钟能发几次」，不是「每段翻多好」。
 * 一整篇 111 段的论文逐段发 = 111 次请求，必然撞限流；按 900 字符打包后通常只剩十几二十次。
 * 接口会按换行把每段分开返回，切回来还能逐段对齐；万一切不齐就退回逐段请求，保证结果不错位。
 */
export async function translateTexts(
  texts: string[],
  settings: TranslationSettings,
): Promise<TranslateOutcome[]> {
  const out: TranslateOutcome[] = texts.map(() => ({ text: '', engine: 'none' }))
  const pending: number[] = []
  for (let i = 0; i < texts.length; i++) {
    const raw = texts[i]
    const trimmed = raw.trim()
    if (!trimmed) {
      out[i] = { text: '', engine: 'none' }
    } else if (isChinese(trimmed)) {
      out[i] = { text: trimmed, engine: 'passthrough' }
    } else if (settings.provider === 'local') {
      out[i] = { text: localTranslate(trimmed), engine: '本地词典' }
    } else if (settings.provider === 'custom' && settings.customUrl.trim()) {
      pending.push(i)
    } else {
      pending.push(i)
    }
  }
  if (!pending.length) return out

  const provider = settings.provider
  if (provider === 'custom' && settings.customUrl.trim()) {
    const failures: string[] = []
    for (const i of pending) {
      try {
        out[i] = {
          text: await customEndpoint(settings.customUrl.trim(), texts[i].trim(), settings.target),
          engine: '自定义接口',
        }
      } catch (e) {
        out[i] = offlineFallback(texts[i].trim(), '自定义接口失败：' + brief(e))
        failures.push(brief(e))
      }
    }
    void failures
    return out
  }

  const order: string[] =
    provider === 'mymemory' ? ['MyMemory', 'Google', '有道'] : ['AI', 'Google', '有道', 'MyMemory']
  const live = order.filter(engineAvailable)
  const plan = live.length ? live : order
  const failures: string[] = []

  for (const engine of plan) {
    const limit = BATCH_LIMIT[engine] || 900
    const todo = pending.filter((i) => !out[i].text)
    if (!todo.length) break
    const groups = packBatches(
      todo.map((i) => texts[i].trim()),
      limit,
    )
    const got: Record<number, string> = {}
    let broke = false
    for (let g = 0; g < groups.length && !broke; g++) {
      const group = groups[g]
      const joined = group.map((k) => todo[k]).map((ti) => texts[ti].trim()).join('\n')
      let pieces: string[] | null = null
      try {
        if (group.length === 1) {
          pieces = [await engineCall(engine, joined, settings.target)]
        } else {
          const merged = await engineCall(engine, joined, settings.target)
          const parts = merged.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 0)
          if (parts.length === group.length) pieces = parts
        }
      } catch (e) {
        let msg = brief(e)
        // 限流是有节奏的：撞上 411/429 先退一大步再试同一批，比重头再来省得多。
        // 一轮退不够就再退一轮（12s → 20s → 30s），整篇长文档才不至于翻到一半就断掉。
        for (let attempt = 0; attempt < RATE_LIMIT_RETRIES && isRateLimit(msg); attempt++) {
          await sleep(RATE_LIMIT_BACKOFF_MS + attempt * 8000)
          try {
            const merged = await engineCall(engine, joined, settings.target)
            const parts = merged.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 0)
            pieces = group.length === 1 ? [merged] : parts.length === group.length ? parts : null
            msg = ''
            break
          } catch (e2) {
            msg = brief(e2)
            slowDown(engine)
          }
        }
        // 退完几轮还是限流 → 换下一个引擎，这一批留着以后重翻
        if (msg) {
          engineDownUntil[engine] = Date.now() + ENGINE_COOLDOWN_MS
          failures.push(engine + ' 失败：' + msg)
          broke = true
          break
        }
      }
      if (!pieces) {
        // 行数对不上（接口把多段并成一段，或吞了空行）→ 这一批退回逐段请求
        pieces = []
        for (const ti of group.map((k) => todo[k])) {
          try {
            pieces.push(await engineCall(engine, texts[ti].trim(), settings.target))
          } catch (e) {
            pieces.push('')
          }
          await sleep(120)
        }
      }
      for (let k = 0; k < group.length; k++) {
        if (pieces[k]) got[todo[group[k]]] = pieces[k]
      }
      if (g < groups.length - 1) await sleep(paceOf(engine))
    }
    // 中途被打断也要留住已经翻好的批次，别让用户白等一场
    for (const i of Object.keys(got)) {
      out[Number(i)] = {
        text: got[Number(i)],
        engine,
        warning: failures.length > 1 ? failures.slice(0, -1).join('；') + '，已自动改用 ' + engine : undefined,
      }
    }
  }

  const rest = pending.filter((i) => !out[i].text)
  for (const i of rest) out[i] = offlineFallback(texts[i].trim(), failures.join('；') || '在线翻译不可用')
  return out
}

export function lookupWord(word: string): string | null {
  const key = word.toLowerCase().replace(/[^a-z-]/g, '')
  const zh = DICT[key]
  return zh && zh.length > 0 ? zh : null
}

export const DICTIONARY_SIZE = Object.keys(DICT).length