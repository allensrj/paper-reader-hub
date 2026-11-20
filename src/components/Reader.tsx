import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DocTr, Highlight, HighlightColor, HLRect, Paper, TrPara } from '../types'
import { translateText, translateTexts, lookupWord } from '../lib/translate'
import { loadPdfDoc, dropPdfDoc, pageParagraphs } from '../lib/pdf'
import { getPdf, putPdf, getDocTr, putDocTr } from '../lib/pdfstore'
import { buildDemoPdf } from '../lib/demoPdf'
import { TR_CACHE_KEY_PREFIX, uid } from '../lib/store'
import { COLORS } from '../lib/colors'
import { PdfStage } from './PdfView'

interface Props {
  paper: Paper
  fontSize: number
  trCache: Record<string, string>
  onCache: (entries: Record<string, string>) => void
  onAddHighlight: (h: Highlight) => void
  onPatch: (patch: Partial<Paper>) => void
  onToast: (msg: string) => void
  onOpenNotes: () => void
  onRemoveHighlight: (hid: string) => void
  onUpdateHighlight: (hid: string, patch: Partial<Highlight>) => void
}

interface SelState {
  text: string
  page: number
  rects: HLRect[]
  x: number
  y: number
}

/** 一条译文：除了原文/译文，还带着它在 PDF 里的位置，点一下就能跳回去 */
type Pair = TrPara

/** 连续这么多次翻译都失败，就先停下，免得把整页/整篇都刷成告警 */
const MAX_CONSECUTIVE_FAILURES = 3
/** 只有真译文才进缓存：'原文'/'本地词典' 是兜底结果，缓存下来会让用户再也没机会重试成功 */
const CACHEABLE = new Set(['AI', 'Google', '有道', 'MyMemory', '自定义接口'])

interface DockState {
  kind: 'word' | 'sentence' | 'page' | 'doc'
  source: string
  text: string
  busy: boolean
  pairs?: Pair[]
  progress?: string
  /** 实际出译文的引擎（Google / MyMemory / 本地词典 / 原文） */
  engine?: string
  /** 引擎降级或失败时给用户看的原因，不再静默吞掉 */
  warning?: string
  /** 这份译文是不是从本地存档读出来的（再点一次不用重翻） */
  fromSaved?: boolean
}

const TARGET = { provider: 'auto' as const, target: 'zh-CN', customUrl: '' }
const BASE_WIDTH = 700
/** 译文栏宽度：能拖着调，记在本地，下次打开还是这个宽度 */
const DEFAULT_DOCK_W = 300
const MIN_DOCK_W = 220
/** 顺便给 PDF 留的最小宽度，别把阅读区拖没了 */
const MIN_READER_W = 320
const DOCK_W_KEY = 'paper-board-dock-w'

function cacheKey(paperId: string, text: string): string {
  // 前缀带缓存版本：旧的破碎译文即使还躺在 localStorage 里，也不会再被取出来展示
  return TR_CACHE_KEY_PREFIX + paperId + '|' + text.slice(0, 120) + '|' + text.length
}

export default function Reader(props: Props) {
  const { paper, trCache, onCache, onAddHighlight, onToast, onRemoveHighlight, onUpdateHighlight } = props
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /** PDF 和译文栏之间的那根分隔条：两边宽度由它决定 */
  const mainRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)
  /** 拖动中的标志（给 ResizeObserver 用，避免每帧重排 PDF） */
  const draggingRef = useRef(false)
  const fitRef = useRef<(() => void) | null>(null)
  /** 当前译文栏宽度（松手时写 localStorage，避免在 setState 里做副作用） */
  const dockWRef = useRef(0)
  const [doc, setDoc] = useState<any>(null)
  const [loadErr, setLoadErr] = useState('')
  const [sel, setSel] = useState<SelState | null>(null)
  const [dock, setDock] = useState<DockState | null>(null)
  const [markMenu, setMarkMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [baseW, setBaseW] = useState(BASE_WIDTH)
  const [prog, setProg] = useState({ page: 1, ratio: 0 })
  const [commentBox, setCommentBox] = useState<{ text: string; page: number; rects: HLRect[] } | null>(null)
  const [commentText, setCommentText] = useState('')
  /** 点右侧译文时，在 PDF 上闪一下对应段落的位置 */
  const [flash, setFlash] = useState<{ page: number; top: number; bottom: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dockW, setDockW] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(DOCK_W_KEY))
      if (Number.isFinite(saved) && saved >= MIN_DOCK_W) return saved
    } catch {
      /* 读不到就用默认值 */
    }
    return DEFAULT_DOCK_W
  })
  dockWRef.current = dockW

  const [pageTr, setPageTr] = useState<{ page: number; pairs: Pair[]; busy: number; total: number } | null>(null)
  const [docTr, setDocTr] = useState<{ pairs: Pair[]; busy: number; total: number } | null>(null)

  // 页面宽度跟着阅读区自适应：100% 就是刚好铺满，缩放是在此基础上放大缩小
  // 拖分隔条的过程中先不重排纸张（每动一像素重画一遍 canvas 会卡），松手后再对齐一次
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const fit = () => {
      if (draggingRef.current) return
      setBaseW(Math.max(340, el.clientWidth - 40))
    }
    fitRef.current = fit
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => {
      ro.disconnect()
      fitRef.current = null
    }
  }, [])

  // 拖分隔条时的移动/松手挂在 window 上：鼠标甩出阅读区也不会中断，松手即停
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current
      if (!d) return
      const total = mainRef.current ? mainRef.current.clientWidth : 0
      const max = Math.max(MIN_DOCK_W, total - MIN_READER_W)
      const next = Math.min(max, Math.max(MIN_DOCK_W, d.startW - (e.clientX - d.startX)))
      dockWRef.current = Math.round(next)
      setDockW(dockWRef.current)
    }
    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      draggingRef.current = false
      document.body.classList.remove('resizing')
      // 松手后让纸张按新宽度重排一次
      window.setTimeout(() => fitRef.current && fitRef.current(), 0)
      try {
        localStorage.setItem(DOCK_W_KEY, String(dockWRef.current))
      } catch {
        /* 存不了就只影响下次默认宽度 */
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // 窗口变窄时别让译文栏把 PDF 挤没：超过可用宽度就自动收一收
  useEffect(() => {
    const el = mainRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const max = Math.max(MIN_DOCK_W, el.clientWidth - MIN_READER_W)
      setDockW((w) => (w > max ? Math.round(max) : w))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 缩放后原来那个浮条/划线菜单的坐标已经失效，直接收起，避免它飘在原地
  useEffect(() => {
    setSel(null)
    setMarkMenu(null)
  }, [zoom])

  useEffect(() => {
    setSel(null)
    setDock(null)
    setMarkMenu(null)
    setZoom(1)
    setPageTr(null)
    setDocTr(null)
    setDoc(null)
    setLoadErr('')
    let alive = true
    ;(async () => {
      try {
        let buf: ArrayBuffer | null = null
        if (paper.source === 'builtin') {
          const bytes = buildDemoPdf(paper.textPages)
          buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
          await putPdf(paper.id, buf)
        } else {
          buf = await getPdf(paper.id)
        }
        if (!alive) return
        if (!buf) {
          setLoadErr('这篇论文的原版 PDF 没有保存在本地（旧数据或文件被清理）。可以重新导入 PDF，或用下面的按钮把文字层还原成 PDF。')
          return
        }
        const loaded = await loadPdfDoc(paper.id, buf)
        if (!alive) return
        setDoc(loaded)
      } catch (err) {
        console.warn('load pdf failed', err)
        if (alive) setLoadErr('PDF 解析失败：' + String(err))
      }
    })()
    return () => {
      alive = false
    }
  }, [paper.id, paper.source])

  useEffect(() => {
    return () => {
      dropPdfDoc(paper.id)
    }
  }, [paper.id])

  const regenerate = useCallback(async () => {
    try {
      const bytes = buildDemoPdf(paper.textPages)
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      await putPdf(paper.id, buf)
      const loaded = await loadPdfDoc(paper.id, buf)
      setDoc(loaded)
      setLoadErr('')
      onToast('已根据文字层生成 PDF')
    } catch (err) {
      onToast('生成失败：' + String(err))
    }
  }, [paper.id, paper.textPages, onToast])

  const askWord = useCallback(async (word: string) => {
    const local = lookupWord(word)
    setDock({ kind: 'word', source: word, text: local || '', busy: !local, engine: local ? '本地词典' : undefined })
    if (!local) {
      const out = await translateText(word, TARGET)
      setDock((d) =>
        d && d.kind === 'word' && d.source === word
          ? { ...d, text: out.text, busy: false, engine: out.engine, warning: out.warning }
          : d,
      )
    }
  }, [])

  const askSentence = useCallback(async (text: string) => {
    const key = cacheKey(paper.id, text)
    if (trCache[key]) {
      setDock({ kind: 'sentence', source: text, text: trCache[key], busy: false, engine: '缓存' })
      return
    }
    setDock({ kind: 'sentence', source: text, text: '', busy: true })
    const out = await translateText(text, TARGET)
    setDock((d) =>
      d && d.kind === 'sentence' && d.source === text
        ? { ...d, text: out.text, busy: false, engine: out.engine, warning: out.warning }
        : d,
    )
    // 只缓存真正的在线译文：兜底原文/词典碎片留在缓存里，下次看起来就像「翻不出来」
    if (out.engine === 'Google' || out.engine === 'MyMemory' || out.engine === '自定义接口') {
      onCache({ [key]: out.text })
    }
  }, [paper.id, trCache, onCache])

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.selbar') || target.closest('.mmenu') || target.closest('.tr-dock')) return
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) {
      setSel(null)
      return
    }
    const text = selection.toString().replace(/\s+/g, ' ').trim()
    if (!text) {
      setSel(null)
      return
    }
    let node: Node | null = selection.anchorNode
    let pageEl: HTMLElement | null = null
    while (node) {
      const el = node as HTMLElement
      if (el.dataset && el.dataset.page) {
        pageEl = el
        break
      }
      node = el.parentElement
    }
    const host = scrollRef.current
    if (!pageEl || !host) {
      setSel(null)
      return
    }
    const range = selection.getRangeAt(0)
    const pageRect = pageEl.getBoundingClientRect()
    const rects: HLRect[] = []
    for (const r of Array.from(range.getClientRects())) {
      if (r.width < 1 || r.height < 1) continue
      rects.push({
        x: (r.left - pageRect.left) / pageRect.width,
        y: (r.top - pageRect.top) / pageRect.height,
        w: r.width / pageRect.width,
        h: r.height / pageRect.height,
      })
    }
    if (rects.length === 0) {
      setSel(null)
      return
    }
    const box = range.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    setSel({
      text: text.slice(0, 4000),
      page: Number(pageEl.dataset.page || 1),
      rects,
      x: box.left - hostRect.left + host.scrollLeft + box.width / 2,
      y: Math.max(8, box.top - hostRect.top + host.scrollTop - 8),
    })
    setMarkMenu(null)
  }, [])

  const onHlClick = useCallback((hid: string, clientX: number, clientY: number) => {
    const host = scrollRef.current
    if (!host) return
    const hostRect = host.getBoundingClientRect()
    setMarkMenu({ id: hid, x: clientX - hostRect.left + host.scrollLeft, y: clientY - hostRect.top + host.scrollTop })
    setSel(null)
  }, [])

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      let raw = (window.getSelection()?.toString() || '').trim()
      if (!raw) {
        // 有些浏览器双击后立刻收起选区，退回到按坐标取词
        const doc: any = document
        const range: Range | null = doc.caretRangeFromPoint ? doc.caretRangeFromPoint(e.clientX, e.clientY) : null
        if (range && range.startContainer.nodeType === 3) {
          const text = range.startContainer.textContent || ''
          const at = range.startOffset
          const left = text.slice(0, at).search(/[A-Za-z'-]*$/)
          const right = text.slice(at).match(/^[A-Za-z'-]*/)
          raw = left >= 0 ? text.slice(left, at) + (right ? right[0] : '') : right ? right[0] : ''
        }
      }
      raw = raw.replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z'-]+$/, '')
      if (!raw || raw.length > 40) return
      askWord(raw)
      setSel(null)
    },
    [askWord],
  )

  const applyHighlight = (color: HighlightColor) => {
    if (!sel) return
    onAddHighlight({
      id: uid('hl'),
      page: sel.page,
      blockId: '',
      text: sel.text.slice(0, 600),
      color,
      note: '',
      createdAt: Date.now(),
      rects: sel.rects,
    })
    window.getSelection()?.removeAllRanges()
    setSel(null)
  }

  const onRatio = useCallback((page: number, ratio: number) => {
    setProg((cur) => (ratio >= cur.ratio ? { page, ratio } : cur))
  }, [])

  const jumpToPage = useCallback((n: number, top?: number, bottom?: number) => {
    const host = scrollRef.current
    if (!host) return
    const el = host.querySelector('.pdfpage[data-page="' + n + '"]') as HTMLElement | null
    if (!el) return
    // 指定了段落位置就把那一段滚到视口上方三分之一处，否则只跳到页首
    const offset = typeof top === 'number' ? el.offsetTop + top * el.offsetHeight - host.clientHeight / 3 : el.offsetTop - 20
    host.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' })
    if (typeof top === 'number') setFlash({ page: n, top, bottom: typeof bottom === 'number' ? bottom : top })
  }, [])

  // 高亮闪一下就走，别把版面一直染着
  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 1800)
    return () => window.clearTimeout(t)
  }, [flash])

  const translatePage = useCallback(async (pageNumber: number) => {
    if (!doc) return
    // 已经开着本页翻译时再点一次就是关掉它
    if (dock && dock.kind === 'page') {
      setDock(null)
      return
    }
    setDock({ kind: 'page', source: 'P' + pageNumber, text: '', busy: true, pairs: [], progress: '读取文字…' })
    try {
      const page = await doc.getPage(pageNumber)
      const paras = await pageParagraphs(page, pageNumber)
      const pairs: Pair[] = paras.map((p) => ({
        src: p.text,
        dst: trCache[cacheKey(paper.id, p.text)] || '',
        page: p.page,
        top: p.top,
        bottom: p.bottom,
      }))
      const todo = pairs.map((p, i) => (p.dst ? -1 : i)).filter((i) => i >= 0)
      setDock({
        kind: 'page',
        source: 'P' + pageNumber,
        text: '',
        busy: true,
        pairs,
        progress: '翻译中 0/' + pairs.length,
      })
      if (!todo.length) {
        setDock({ kind: 'page', source: 'P' + pageNumber, text: '', busy: false, pairs, progress: '' })
        return
      }
      // 整页一次批量提交：免费引擎按次数限流，逐段发请求等于自己把自己限死
      const outcomes = await translateTexts(todo.map((i) => pairs[i].src), TARGET)
      const entries: Record<string, string> = {}
      let failed = 0
      todo.forEach((idx, k) => {
        const out = outcomes[k]
        pairs[idx] = { ...pairs[idx], dst: out.text, engine: out.engine, warning: out.warning }
        if (CACHEABLE.has(out.engine)) entries[cacheKey(paper.id, pairs[idx].src)] = out.text
        else if (out.engine === '原文') failed++
      })
      if (failed) onToast('有 ' + failed + ' 段在线翻译失败，已保留原文，稍后重新点「翻译本页」可重试')
      if (Object.keys(entries).length) onCache(entries)
      setDock({ kind: 'page', source: 'P' + pageNumber, text: '', busy: false, pairs, progress: '' })
    } catch (err) {
      onToast('翻译失败：' + String(err))
      setDock(null)
    }
  }, [doc, dock, paper.id, trCache, onCache, onToast])

  /**
   * 全文翻译。翻完的结果整篇存进 IndexedDB（按论文 id），下次再点直接读出来，
   * 不用重新抽文字、也不用再等引擎——同一篇论文只有第一次是真的在翻。
   */
  const translateDoc = useCallback(
    async (force = false) => {
      if (!doc) return
      if (dock && dock.kind === 'doc' && !force) {
        setDock(null)
        return
      }
      if (!force) {
        const saved = await getDocTr<DocTr>(paper.id).catch(() => null)
        if (saved && saved.paras && saved.paras.length && saved.pageCount === doc.numPages) {
          setDock({
            kind: 'doc',
            source: paper.title,
            text: '',
            busy: false,
            pairs: saved.paras,
            fromSaved: true,
            progress: '已保存 · ' + new Date(saved.updatedAt).toLocaleString(),
          })
          return
        }
      }
      setDock({ kind: 'doc', source: paper.title, text: '', busy: true, pairs: [], progress: '读取全文字…' })
      const entries: Record<string, string> = {}
      const all: Pair[] = []
      let fails = 0
      let stopped = false
      const total = doc.numPages
      try {
        for (let n = 1; n <= total && !stopped; n++) {
          const page = await doc.getPage(n)
          const paras = await pageParagraphs(page, n)
          const fresh: Pair[] = []
          for (const p of paras) {
            const cached = trCache[cacheKey(paper.id, p.text)]
            const pair: Pair = {
              src: p.text,
              dst: cached || '',
              engine: cached ? '缓存' : undefined,
              page: p.page,
              top: p.top,
              bottom: p.bottom,
            }
            all.push(pair)
            if (!cached) fresh.push(pair)
          }
          if (fresh.length) {
            // 同页段落一次批量提交，十几二十次请求就能翻完一篇，不容易撞上限流
            const outcomes = await translateTexts(fresh.map((x) => x.src), TARGET)
            let pageOk = 0
            outcomes.forEach((out, k) => {
              fresh[k].dst = out.text
              fresh[k].engine = out.engine
              fresh[k].warning = out.warning
              if (CACHEABLE.has(out.engine)) {
                entries[cacheKey(paper.id, fresh[k].src)] = out.text
                pageOk++
              }
            })
            // 只按「整页一段都没翻成」判失败：单段落空翻下一段就好，
            // 一有段落失败就整篇停会让长文档永远翻不完
            fails = pageOk > 0 ? 0 : fails + 1
          }
          setDock({
            kind: 'doc',
            source: paper.title,
            text: '',
            busy: true,
            pairs: all.slice(),
            progress:
              '第 ' + n + '/' + total + ' 页 · 已译 ' + all.filter((x) => x.dst && x.engine !== '原文').length + '/' + all.length + ' 段',
          })
          if (fails >= MAX_CONSECUTIVE_FAILURES) {
            // 已经翻好的段落留着，不再把整篇掀掉
            stopped = true
            onToast('在线翻译连续失败，全文翻译已暂停，可稍后点「全文翻译」继续')
            break
          }
        }
        for (const p of all) {
          if (!p.dst) {
            p.dst = p.src
            p.engine = '原文'
            p.warning = '在线翻译已暂停，这一段先保留原文，稍后重新点「全文翻译」可继续'
          }
        }
        if (Object.keys(entries).length) onCache(entries)
        // 只要有真译文就整篇存档：下次点开秒出，断网也还能看
        if (all.some((x) => x.engine && x.engine !== '原文' && x.engine !== '本地词典')) {
          putDocTr(paper.id, { paperId: paper.id, pageCount: total, paras: all, updatedAt: Date.now() } as DocTr).catch(
            () => undefined,
          )
        }
        setDock({ kind: 'doc', source: paper.title, text: '', busy: false, pairs: all, progress: stopped ? '已暂停' : '' })
      } catch (err) {
        if (Object.keys(entries).length) onCache(entries)
        onToast('全文翻译中断：' + String(err))
        setDock((d) => (d && d.kind === 'doc' ? { ...d, busy: false, pairs: all } : d))
      }
    },
    [doc, dock, paper.id, paper.title, trCache, onCache, onToast],
  )

  const copyAll = useCallback(async () => {
    try {
      const parts: string[] = []
      if (doc) {
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const paras = await pageParagraphs(page, n)
          parts.push('— P' + n + ' —')
          parts.push(paras.map((p) => p.text).join('\n'))
        }
      } else {
        parts.push(paper.textPages.map((p) => p.blocks.map((b) => b.text).join('\n')).join('\n\n'))
      }
      navigator.clipboard?.writeText(parts.join('\n\n'))
      onToast('已复制全文')
    } catch (err) {
      onToast('复制失败：' + String(err))
    }
  }, [doc, paper.textPages, onToast])

  const aspect = useMemo(() => 792 / 612, [])
  const targetWidth = Math.round(baseW * zoom)

  if (loadErr) {
    return (
      <div className="reader-col">
        <div className="empty">
          <h3>打不开这篇论文的原版 PDF</h3>
          <p>{loadErr}</p>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn primary" onClick={regenerate} disabled={paper.textPages.length === 0}>用文字层还原成 PDF</button>
            <button className="btn ghost" onClick={onToast.bind(null, '请在顶部「导入 PDF」里重新选择文件')}>重新导入</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="reader-col">
      <div className="reader-toolbar">
        <button className="btn" onClick={() => translatePage(prog.page)} disabled={!doc}>
          {dock && dock.kind === 'page' && dock.busy ? '翻译中…' : '翻译本页'}
        </button>
        <button
          className={'btn' + (dock && dock.kind === 'doc' ? ' primary' : '')}
          onClick={() => translateDoc()}
          disabled={!doc}
        >
          {dock && dock.kind === 'doc' && dock.busy ? '全文翻译中…' : dock && dock.kind === 'doc' ? '关闭全文翻译' : '全文翻译'}
        </button>
        <button className="btn ghost" onClick={copyAll}>复制全文</button>

        <div className="zoom">
          <button onClick={() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10))} title="缩小">−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))} title="放大">+</button>
          <button onClick={() => setZoom(1)} title="恢复 100%">重置</button>
        </div>

        <div className="zoom">
          <button onClick={() => jumpToPage(Math.max(1, prog.page - 1))} title="上一页">‹</button>
          <span>P{prog.page}</span>
          <button onClick={() => jumpToPage(Math.min(doc ? doc.numPages : paper.pageCount, prog.page + 1))} title="下一页">›</button>
        </div>

        <div className="spacer" />
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          {doc ? doc.numPages : paper.pageCount} 页 · {paper.highlights.length} 条划线
        </span>
      </div>

      <div className={'reader-main' + (dragging ? ' resizing' : '')} ref={mainRef}>
        <div
          className="reader-scroll"
          ref={scrollRef}
          onMouseUp={onMouseUp}
          onDoubleClick={onDoubleClick}
          onClick={(e) => {
            const target = e.target as HTMLElement
            if (!target.closest('.mmenu')) setMarkMenu(null)
          }}
        >
          {doc ? (
            <PdfStage
              doc={doc}
              targetWidth={targetWidth}
              aspect={aspect}
              highlights={paper.highlights}
              onHlClick={onHlClick}
              onPageRatio={onRatio}
              focus={flash}
            />
          ) : (
            <div className="pdf-loading">正在解析 PDF…</div>
          )}

          {sel && (
            <div className="selbar" style={{ left: sel.x, top: sel.y }}>
              {COLORS.map((c) => (
                <button key={c.key} title={'用' + c.label + '划线'} onClick={() => applyHighlight(c.key)}>
                  <i className="dot" style={{ background: c.hex }} />
                </button>
              ))}
              <span className="sep" />
              <button onClick={() => askSentence(sel.text)}>译</button>
              <button
                onClick={() => {
                  setCommentBox({ text: sel.text, page: sel.page, rects: sel.rects })
                  setCommentText('')
                  setSel(null)
                }}
              >
                ✎ 评论
              </button>
            </div>
          )}

          {markMenu && (
            <div className="mmenu" style={{ left: markMenu.x, top: markMenu.y }}>
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  title={'改为' + c.label}
                  className="swatch"
                  style={{ background: c.hex }}
                  onClick={() => {
                    onUpdateHighlight(markMenu.id, { color: c.key })
                    setMarkMenu(null)
                  }}
                />
              ))}
              <span className="sep" />
              <button
                className="danger"
                onClick={() => {
                  onRemoveHighlight(markMenu.id)
                  setMarkMenu(null)
                }}
              >
                取消划线
              </button>
            </div>
          )}
        </div>

        {dock && (
          <div
            className={'tr-split' + (dragging ? ' on' : '')}
            title="拖动调整译文栏宽度（双击恢复默认）"
            onMouseDown={(e) => {
              e.preventDefault()
              dragRef.current = { startX: e.clientX, startW: dockW }
              draggingRef.current = true
              setDragging(true)
              document.body.classList.add('resizing')
            }}
            onDoubleClick={() => {
              setDockW(DEFAULT_DOCK_W)
              try {
                localStorage.setItem(DOCK_W_KEY, String(DEFAULT_DOCK_W))
              } catch {
                /* 忽略 */
              }
            }}
          >
            <span />
          </div>
        )}

        {dock && (
          <aside className="tr-dock" style={{ width: dockW }}>
            <div className="tr-dock-head">
              <span>
                {dock.kind === 'word' ? '单词' : dock.kind === 'sentence' ? '句子' : dock.kind === 'page' ? '本页翻译' : '全文翻译'}
              </span>
              <div className="spacer" />
              <button className="btn ghost sm" onClick={() => setDock(null)} title="关闭">×</button>
            </div>
            <div className="tr-dock-scroll">
              {dock.busy && <div className="tr-busy">{dock.progress || '翻译中…'}</div>}
              {dock.fromSaved && !dock.busy && (
                <div className="tr-saved">
                  <span>{dock.progress || '已保存的译文'}</span>
                  <button className="btn ghost sm" onClick={() => translateDoc(true)} title="忽略存档，重新翻译一遍">
                    重新翻译
                  </button>
                </div>
              )}
              {dock.pairs ? (
                dock.pairs.map((p, i) => (
                  <div
                    className={'tr-pair' + (p.engine === '原文' ? ' is-fallback' : '')}
                    key={i}
                    title={'点击定位到第 ' + p.page + ' 页'}
                    onClick={() => jumpToPage(p.page, p.top, p.bottom)}
                  >
                    <div className="tr-pair-src">{p.src}</div>
                    <div className="tr-pair-dst">{p.dst || '…'}</div>
                    {(p.engine === '原文' || p.engine === '本地词典') && (
                      <div className="tr-engine">
                        未翻译 · {p.warning || '在线翻译暂时不可用，稍后重新点一次即可重试'}
                      </div>
                    )}
                    <div className="tr-pair-page">P{p.page}</div>
                  </div>
                ))
              ) : (
                <>
                  <div className="tr-src">{dock.source}</div>
                  <div className="tr-out">{dock.busy ? '翻译中…' : dock.text || '暂无译文'}</div>
                  {!dock.busy && dock.engine && dock.engine !== 'Google' && (
                    <div className="tr-engine">引擎：{dock.engine}</div>
                  )}

                  {!dock.busy && dock.warning && <div className="tr-warn">{dock.warning}</div>}
                </>
              )}
            </div>
          </aside>
        )}
      </div>

      {commentBox && (
        <CommentDialog
          quote={commentBox.text}
          value={commentText}
          onChange={setCommentText}
          onCancel={() => setCommentBox(null)}
          onSave={(color) => {
            onAddHighlight({
              id: uid('hl'),
              page: commentBox.page,
              blockId: '',
              text: commentBox.text.slice(0, 600),
              color,
              note: commentText,
              createdAt: Date.now(),
              rects: commentBox.rects,
            })
            setCommentBox(null)
            onToast('已添加评论')
          }}
        />
      )}
    </div>
  )
}

function CommentDialog(props: {
  quote: string
  value: string
  onChange: (v: string) => void
  onCancel: () => void
  onSave: (color: HighlightColor) => void
}) {
  const [color, setColor] = useState<HighlightColor>('yellow')
  return (
    <div className="modal-mask" onClick={props.onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(520px, 92vw)' }}>
        <header>针对这句评论</header>
        <div className="content">
          <div className="hl-card">
            <div className="quote">{props.quote.slice(0, 400)}</div>
          </div>
          <div className="field">
            <label>你的评论</label>
            <textarea
              autoFocus
              value={props.value}
              onChange={(e) => props.onChange(e.target.value)}
              placeholder="为什么重要？和什么有关？有什么疑问？"
              style={{ minHeight: 100 }}
            />
          </div>
          <div className="field">
            <label>划线颜色</label>
            <div className="chip-row">
              {COLORS.map((c) => (
                <button key={c.key} className={'chip' + (color === c.key ? ' on' : '')} onClick={() => setColor(c.key)}>
                  <i className="dot" style={{ background: c.hex, display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 5 }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <footer>
          <button className="btn ghost" onClick={props.onCancel}>取消</button>
          <button className="btn primary" onClick={() => props.onSave(color)}>保存</button>
        </footer>
      </div>
    </div>
  )
}
