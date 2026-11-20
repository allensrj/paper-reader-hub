import type { PageText, Para, TextBlock } from '../types'

let pdfjsPromise: Promise<any> | null = null

async function getPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs'
      return pdfjs
    })()
  }
  return pdfjsPromise
}

interface LineGroup {
  start: number
  end: number
  y: number
  size: number
  text: string
  body: string
}

export function blocksFromLines(lines: LineGroup[], pageNumber: number): TextBlock[] {
  const blocks: TextBlock[] = []
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, ' ').trim()
    if (!text || text.length < 2) continue
    let kind: TextBlock['kind'] = 'body'
    if (line.size >= 15 && text.length < 140) kind = 'heading'
    else if (/^(Figure|Table|Fig\.)\s*\d/i.test(text)) kind = 'caption'
    else if (line.size >= 12 && text.length < 120) kind = 'heading'
    blocks.push({ id: 'b' + blocks.length, kind, text })
  }
  if (pageNumber === 1 && blocks.length > 0 && blocks[0].kind !== 'heading') {
    blocks[0] = { ...blocks[0], kind: 'title' }
  }
  return blocks
}

export function linesToBlocks(items: any[], pageNumber: number): TextBlock[] {
  const lines: LineGroup[] = []
  for (const item of items) {
    if (typeof item.str !== 'string') continue
    const transform = item.transform || [1, 0, 0, 1, 0, 0]
    const x = transform[4] as number
    const y = Math.round((transform[5] as number) * 10) / 10
    const size = Math.abs(transform[3] as number) || Math.abs(transform[0] as number) || 10
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - y) < 2) {
      const gap = x - last.end
      const joiner = gap > 6 ? ' ' : ''
      last.text += joiner + item.str
      last.end = x + (item.str.length * size * 0.5 || 0)
      last.size = Math.max(last.size, size)
    } else {
      lines.push({ start: x, end: x + item.str.length * size * 0.5, y, size, text: item.str, body: '' })
    }
  }
  return blocksFromLines(lines, pageNumber)
}

/** 标准字体（Helvetica/Times 等）目录；缺了它，PDF 里的西文文字画不出来 */
export const STANDARD_FONT_URL = './standard_fonts/'

export interface ExtractedPdf {
  pageCount: number
  pages: PageText[]
  info: { title?: string; author?: string }
}

export async function extractPdf(data: ArrayBuffer): Promise<ExtractedPdf> {
  const pdfjs = await getPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, standardFontDataUrl: STANDARD_FONT_URL }).promise
  const pages: PageText[] = []
  const meta = await doc.getMetadata().catch(() => null)
  const info = (meta && meta.info) || {}
  const limit = Math.min(doc.numPages, 40)
  for (let i = 1; i <= limit; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push({ number: i, blocks: linesToBlocks(content.items as any[], i) })
    page.cleanup()
  }
  return {
    pageCount: doc.numPages,
    pages,
    info: { title: info.Title || '', author: info.Author || '' },
  }
}

export function getPdfjsApi(): Promise<any> {
  return getPdfjs()
}

const docCache = new Map<string, Promise<any>>()

export function loadPdfDoc(id: string, data: ArrayBuffer): Promise<any> {
  const cached = docCache.get(id)
  if (cached) return cached
  const task = (async () => {
    const pdfjs = await getPdfjs()
    return pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false, standardFontDataUrl: STANDARD_FONT_URL }).promise
  })()
  docCache.set(id, task)
  task.catch(() => docCache.delete(id))
  return task
}

export function dropPdfDoc(id: string): void {
  docCache.delete(id)
}

/**
 * 把一页的文字按行聚成段落，用于整页 / 全文翻译。
 * 每段额外带回它在页面中的纵向区间（top/bottom 是 0~1 比例，从上往下量），
 * 这样点右侧译文就能滚回原文那一行。
 */
export async function pageParagraphs(page: any, pageNumber = 1): Promise<Para[]> {
  const content = await page.getTextContent()
  const lines: Array<{ y: number; x: number; text: string; size: number }> = []
  for (const item of (content.items || []) as any[]) {
    if (typeof item.str !== 'string' || !item.str.trim()) continue
    const t = item.transform || [1, 0, 0, 1, 0, 0]
    const y = Math.round((t[5] as number) * 2) / 2
    const size = Math.abs(t[3] as number) || Math.abs(t[0] as number) || 10
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - y) <= 1.6) {
      last.text += (/\s$/.test(last.text) ? '' : ' ') + item.str
      last.size = Math.max(last.size, size)
    } else {
      lines.push({ y, x: t[4] as number, text: item.str, size })
    }
  }
  lines.sort((a, b) => b.y - a.y || a.x - b.x)
  const vp = page.getViewport({ scale: 1 })
  const pageH = vp.height || 792
  const raws: Array<{ text: string; topY: number; bottomY: number }> = []
  let cur = ''
  let curTop = 0
  let curBottom = 0
  let prevY = 0
  let prevSize = 0
  const flush = () => {
    if (!cur) return
    raws.push({ text: cur, topY: curTop, bottomY: curBottom })
    cur = ''
  }
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    const gap = prevY - line.y
    const lineTop = line.y + line.size
    if (cur && gap > Math.max(line.size, prevSize) * 1.7) {
      flush()
      cur = text
      curTop = lineTop
      curBottom = line.y
    } else {
      cur = cur ? cur + ' ' + text : text
      curTop = Math.max(curTop, lineTop)
      curBottom = cur ? Math.min(curBottom || line.y, line.y) : line.y
    }
    prevY = line.y
    prevSize = line.size
  }
  flush()
  const clamp = (v: number) => Math.max(0, Math.min(1, v))
  return raws
    .map((r) => ({
      text: r.text.trim(),
      page: pageNumber,
      top: clamp((pageH - r.topY) / pageH),
      bottom: clamp((pageH - r.bottomY) / pageH),
    }))
    .filter((r) => r.text.length > 1)
}

export async function renderPageToCanvas(data: ArrayBuffer, pageNumber: number, canvas: HTMLCanvasElement, scale: number): Promise<number> {
  const pdfjs = await getPdfjs()
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false, standardFontDataUrl: STANDARD_FONT_URL }).promise
  const page = await doc.getPage(pageNumber)
  const viewport = page.getViewport({ scale })
  const ctx = canvas.getContext('2d')
  if (!ctx) return viewport.height
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  return viewport.height
}
