import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppState, Highlight, Paper, Settings } from '../types'

const KEY = 'paper-board-state-v2'

/**
 * 译文缓存版本。v2 及更早的缓存里混着「在线引擎失败 → 逐词词典拼接」的破碎译文，
 * 那时失败是静默的，界面上分不出哪条是能看的、哪条是垃圾，只能整批作废重翻。
 */
const TR_CACHE_VERSION = 'v3'

/** 缓存键前缀，Reader 拼键时用它，旧键自然全部失效 */
export const TR_CACHE_KEY_PREFIX = TR_CACHE_VERSION + '|'

export const defaultSettings: Settings = {
  translation: { provider: 'auto', target: 'zh-CN', customUrl: '' },
  fontSize: 15,
  sidebarCollapsed: false,
  notesCollapsed: false,
}

/** 丢掉旧版本缓存与早期「本地词典」兜底残骸，避免修复后仍在看旧译文 */
export function sanitizeTrCache(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== 'string' || !v.trim()) continue
    if (k.indexOf(TR_CACHE_KEY_PREFIX) !== 0) continue
    if (v.indexOf('〔本地词典〕') === 0) continue
    out[k] = v
  }
  return out
}

export function uid(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function emptyState(): AppState {
  return { version: 2, papers: [], tabs: [], activeTab: '', trCache: {}, settings: defaultSettings }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const settings = (parsed.settings || {}) as Partial<Settings>
    return {
      version: 2,
      papers: Array.isArray(parsed.papers) ? (parsed.papers as Paper[]) : [],
      tabs: Array.isArray(parsed.tabs) ? (parsed.tabs as string[]) : [],
      activeTab: typeof parsed.activeTab === 'string' ? parsed.activeTab : '',
      trCache: sanitizeTrCache(parsed.trCache),
      settings: {
        ...defaultSettings,
        ...settings,
        translation: { ...defaultSettings.translation, ...(settings.translation || {}) },
      },
    }
  } catch (e) {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    /* quota exceeded: ignore */
  }
}

export interface BoardApi {
  state: AppState
  addPapers: (papers: Paper[]) => void
  updatePaper: (id: string, patch: Partial<Paper>) => void
  deletePapers: (ids: string[]) => void
  openPaper: (id: string) => void
  openTab: (id: string) => void
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  addHighlight: (paperId: string, h: Highlight) => void
  updateHighlight: (paperId: string, hid: string, patch: Partial<Highlight>) => void
  removeHighlight: (paperId: string, hid: string) => void
  cacheTranslation: (entries: Record<string, string>) => void
  patchSettings: (patch: Partial<Settings>) => void
  replaceState: (next: AppState) => void
  resetAll: () => void
}

export function useBoard(): BoardApi {
  const [state, setState] = useState<AppState>(() => loadState())
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => saveState(state), 350)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [state])

  const addPapers = useCallback((papers: Paper[]) => {
    setState((s) => ({ ...s, papers: [...papers, ...s.papers] }))
  }, [])

  const updatePaper = useCallback((id: string, patch: Partial<Paper>) => {
    setState((s) => ({
      ...s,
      papers: s.papers.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
    }))
  }, [])

  const deletePapers = useCallback((ids: string[]) => {
    setState((s) => {
      const set = new Set(ids)
      const papers = s.papers.filter((p) => !set.has(p.id))
      const tabs = s.tabs.filter((t) => !set.has(t))
      const activeTab = set.has(s.activeTab) ? tabs[0] || '' : s.activeTab
      return { ...s, papers, tabs, activeTab }
    })
  }, [])

  const openTab = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.includes(id) ? s.tabs : [...s.tabs, id],
      activeTab: id,
    }))
  }, [])

  const openPaper = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.includes(id) ? s.tabs : [...s.tabs, id],
      activeTab: id,
      papers: s.papers.map((p) => (p.id === id ? { ...p, lastReadAt: Date.now() } : p)),
    }))
  }, [])

  const closeTab = useCallback((id: string) => {
    setState((s) => {
      const index = s.tabs.indexOf(id)
      const tabs = s.tabs.filter((t) => t !== id)
      let activeTab = s.activeTab
      if (s.activeTab === id) activeTab = tabs[Math.min(index, tabs.length - 1)] || ''
      return { ...s, tabs, activeTab }
    })
  }, [])

  const setActiveTab = useCallback((id: string) => {
    setState((s) => ({ ...s, activeTab: id }))
  }, [])

  const addHighlight = useCallback((paperId: string, h: Highlight) => {
    setState((s) => ({
      ...s,
      papers: s.papers.map((p) =>
        p.id === paperId
          ? { ...p, highlights: [...p.highlights, h], updatedAt: Date.now(), status: p.status === 'done' ? 'done' : 'reading' }
          : p,
      ),
    }))
  }, [])

  const updateHighlight = useCallback((paperId: string, hid: string, patch: Partial<Highlight>) => {
    setState((s) => ({
      ...s,
      papers: s.papers.map((p) =>
        p.id === paperId
          ? { ...p, highlights: p.highlights.map((h) => (h.id === hid ? { ...h, ...patch } : h)), updatedAt: Date.now() }
          : p,
      ),
    }))
  }, [])

  const removeHighlight = useCallback((paperId: string, hid: string) => {
    setState((s) => ({
      ...s,
      papers: s.papers.map((p) =>
        p.id === paperId ? { ...p, highlights: p.highlights.filter((h) => h.id !== hid), updatedAt: Date.now() } : p,
      ),
    }))
  }, [])

  const cacheTranslation = useCallback((entries: Record<string, string>) => {
    setState((s) => ({ ...s, trCache: { ...s.trCache, ...entries } }))
  }, [])

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
  }, [])

  const replaceState = useCallback((next: AppState) => {
    setState(next)
  }, [])

  const resetAll = useCallback(() => {
    setState((s) => ({ ...emptyState(), settings: s.settings }))
  }, [])

  return {
    state,
    addPapers,
    updatePaper,
    deletePapers,
    openPaper,
    openTab,
    closeTab,
    setActiveTab,
    addHighlight,
    updateHighlight,
    removeHighlight,
    cacheTranslation,
    patchSettings,
    replaceState,
    resetAll,
  }
}
