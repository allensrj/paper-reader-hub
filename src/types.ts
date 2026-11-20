export type PaperStatus = 'unread' | 'reading' | 'done'

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink'

export type BlockKind = 'title' | 'meta' | 'heading' | 'body' | 'caption'

export type PaperSource = 'pdf' | 'builtin'

export interface TextBlock {
  id: string
  kind: BlockKind
  text: string
}

export interface PageText {
  number: number
  blocks: TextBlock[]
}

export interface HLRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Highlight {
  id: string
  page: number
  blockId: string
  text: string
  color: HighlightColor
  note: string
  createdAt: number
  /** 原版 PDF 上的划线位置（相对页面宽高的 0~1 比例，可能跨多行） */
  rects?: HLRect[]
}

export interface Paper {
  id: string
  title: string
  authors: string
  year: string
  venue: string
  tags: string[]
  status: PaperStatus
  summary: string
  notes: string
  highlights: Highlight[]
  pageCount: number
  fileName: string
  source: PaperSource
  textPages: PageText[]
  addedAt: number
  updatedAt: number
  lastReadAt: number
}

export type TranslateProvider = 'auto' | 'local' | 'mymemory' | 'custom'

export interface TranslationSettings {
  provider: TranslateProvider
  target: string
  customUrl: string
}

export interface Settings {
  translation: TranslationSettings
  fontSize: number
  sidebarCollapsed: boolean
  notesCollapsed: boolean
}

export interface AppState {
  version: number
  papers: Paper[]
  tabs: string[]
  activeTab: string
  trCache: Record<string, string>
  settings: Settings
}

/** 原版 PDF 里的一段文字：带它在页面里的纵向位置（0~1，从上往下量），用于回跳定位 */
export interface Para {
  text: string
  page: number
  top: number
  bottom: number
}

/** 一段译文 + 它对应的原文位置，存进全文翻译结果里 */
export interface TrPara {
  src: string
  dst: string
  engine?: string
  warning?: string
  page: number
  top: number
  bottom: number
}

/** 一整篇译文快照：再点「全文翻译」直接取它，不用重新抽文字、重新等引擎 */
export interface DocTr {
  paperId: string
  pageCount: number
  paras: TrPara[]
  updatedAt: number
}

export type ViewMode = 'reader' | 'library'
