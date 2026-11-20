import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import Reader from './components/Reader'
import NotesPanel from './components/NotesPanel'
import Library from './components/Library'
import ImportDialog from './components/ImportDialog'
import { useBoard, uid } from './lib/store'
import { buildDemoPapers } from './lib/seed'
import { extractPdf } from './lib/pdf'
import { putPdf, delPdf } from './lib/pdfstore'
import type { Paper, ViewMode } from './types'

export default function App() {
  const board = useBoard()
  const { state, addPapers, updatePaper, deletePapers, openPaper, closeTab, setActiveTab, addHighlight, updateHighlight, removeHighlight, cacheTranslation, patchSettings } = board
  const [view, setView] = useState<ViewMode>('reader')
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')
  const [toast, setToast] = useState('')
  const toastTimer = useRef<number | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }, [])

  const activePaper = useMemo(
    () => state.papers.find((p) => p.id === state.activeTab) || null,
    [state.papers, state.activeTab],
  )

  const sidebarCollapsed = state.settings.sidebarCollapsed
  const notesCollapsed = state.settings.notesCollapsed

  useEffect(() => {
    if (state.papers.length === 0 && state.tabs.length === 0) {
      const demos = buildDemoPapers()
      addPapers(demos)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const importFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => /\.pdf$/i.test(f.name))
      if (list.length === 0) {
        setImportMsg('✕ 没有检测到 PDF 文件')
        return
      }
      setImporting(true)
      const created: Paper[] = []
      const failed: string[] = []
      for (let i = 0; i < list.length; i++) {
        const file = list[i]
        setImportMsg('正在解析 ' + (i + 1) + '/' + list.length + '：' + file.name)
        try {
          const buf = await file.arrayBuffer()
          const extracted = await extractPdf(buf.slice(0))
          const id = uid('paper')
          await putPdf(id, buf)
          created.push({
            id,
            title: extracted.info.title || file.name.replace(/\.pdf$/i, ''),
            authors: extracted.info.author || '未知作者',
            year: '',
            venue: '',
            tags: [],
            status: 'unread',
            summary: '',
            notes: '',
            highlights: [],
            pageCount: extracted.pageCount,
            fileName: file.name,
            source: 'pdf',
            textPages: extracted.pages,
            addedAt: Date.now(),
            updatedAt: Date.now(),
            lastReadAt: 0,
          })
        } catch (e) {
          failed.push(file.name + '（' + (e as Error).message + '）')
        }
      }
      setImporting(false)
      if (created.length) {
        addPapers(created)
        setImportMsg('✓ 已导入 ' + created.length + ' 篇' + (failed.length ? '，失败 ' + failed.length + ' 篇' : ''))
        setImportOpen(false)
        showToast('已导入 ' + created.length + ' 篇论文')
        openPaper(created[0].id)
        setView('reader')
      } else {
        setImportMsg('✕ 导入失败：' + failed.join('；'))
      }
    },
    [addPapers, openPaper, showToast],
  )

  // 导入自带的真实 PDF（含插图），用于验证「原版 PDF 渲染」能保留图片
  const importSample = useCallback(async () => {
    try {
      setImporting(true)
      setImportMsg('正在下载示例 PDF…')
      const names = ['含插图的真实 PDF 示例.pdf', '真实文档 PDF 示例.pdf']
      const files: File[] = []
      for (let i = 0; i < 2; i++) {
        const url = i === 0 ? './sample-image.pdf' : './sample-doc.pdf'
        const res = await fetch(url)
        if (!res.ok) throw new Error(url + ' HTTP ' + res.status)
        files.push(new File([await res.blob()], names[i], { type: 'application/pdf' }))
      }
      await importFiles(files)
    } catch (e) {
      setImportMsg('✕ 示例导入失败：' + (e as Error).message)
      setImportOpen(true)
    } finally {
      setImporting(false)
    }
  }, [importFiles])

  const addDemo = useCallback(() => {
    const demos = buildDemoPapers().map((p) => ({ ...p, id: uid('demo'), addedAt: Date.now() }))
    addPapers(demos)
    showToast('已加载 ' + demos.length + ' 篇示例论文')
  }, [addPapers, showToast])

  const exportData = useCallback(
    (kind: 'json' | 'csv') => {
      let blob: Blob
      if (kind === 'json') {
        blob = new Blob([JSON.stringify(state.papers, null, 2)], { type: 'application/json' })
      } else {
        const head = ['标题', '作者', '年份', '会议', '已读完', '标签', '摘要', '笔记', '批注数']
        const esc = (s: string) => '"' + String(s).replace(/"/g, '""') + '"'
        const lines = state.papers.map((p) =>
          [p.title, p.authors, p.year, p.venue, p.status === 'done' ? '是' : '否', p.tags.join('/'), p.summary, p.notes.replace(/\n/g, ' '), String(p.highlights.length)]
            .map(esc)
            .join(','),
        )
        blob = new Blob(['\ufeff' + head.map(esc).join(',') + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = '论文库-' + new Date().toISOString().slice(0, 10) + (kind === 'json' ? '.json' : '.csv')
      a.click()
      URL.revokeObjectURL(url)
      showToast('已导出')
    },
    [state.papers, showToast],
  )

  const removePaper = useCallback(
    (id: string) => {
      if (!window.confirm('确定从论文库删除这篇论文？笔记与划线会一起删除。')) return
      deletePapers([id])
      delPdf(id).catch(() => undefined)
      showToast('已删除')
    },
    [deletePapers, showToast],
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>
            论文知识库学习看板
            <br />
            <small>{state.papers.length} 篇论文 · 本地存储</small>
          </span>
        </div>

        <button className="btn ghost" onClick={() => patchSettings({ sidebarCollapsed: !sidebarCollapsed })} title="显示/隐藏左侧论文库">
          {sidebarCollapsed ? '» 论文库' : '« 收起库'}
        </button>

        <div className="seg">
          <button className={view === 'reader' ? 'active' : ''} onClick={() => setView('reader')}>阅读</button>
          <button className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>论文库总览</button>
        </div>

        <div className="spacer" />

        <button className="btn ghost" onClick={importSample} disabled={importing} title="导入一份自带插图的真实 PDF，验证图片与版式">
          {importing ? '导入中…' : '真实 PDF 示例'}
        </button>
        <button className="btn" onClick={() => setImportOpen(true)}>导入 PDF</button>
        <button className="btn ghost" onClick={() => patchSettings({ notesCollapsed: !notesCollapsed })} title="显示/隐藏右侧笔记栏">
          {notesCollapsed ? '◧ 笔记' : '笔记 »'}
        </button>
      </header>

      <div className="body">
        <Sidebar
          papers={state.papers}
          activeId={state.activeTab}
          collapsed={sidebarCollapsed}
          importing={importing}
          onOpen={(id) => { openPaper(id); setView('reader') }}
          onImport={() => setImportOpen(true)}
          onDropFiles={importFiles}
          onAddDemo={addDemo}
          onDelete={removePaper}
        />

        <div className="main">
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            {view === 'reader' && (
              <div className="tabs">
                {state.tabs.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-3)' }}>还没有打开的标签页</div>}
                {state.tabs.map((id) => {
                  const p = state.papers.find((x) => x.id === id)
                  if (!p) return null
                  return (
                    <div key={id} className={'tab' + (state.activeTab === id ? ' active' : '')} onClick={() => setActiveTab(id)} title={p.title}>
                      <span>{p.title}</span>
                      <button className="x" onClick={(e) => { e.stopPropagation(); closeTab(id) }}>×</button>
                    </div>
                  )
                })}
              </div>
            )}

            {view === 'reader' ? (
              activePaper ? (
                <Reader
                  paper={activePaper}
                  fontSize={state.settings.fontSize}
                  trCache={state.trCache}
                  onCache={cacheTranslation}
                  onAddHighlight={(h) => addHighlight(activePaper.id, h)}
                  onPatch={(patch) => updatePaper(activePaper.id, patch)}
                  onToast={showToast}
                  onOpenNotes={() => patchSettings({ notesCollapsed: false })}
                  onRemoveHighlight={(hid) => removeHighlight(activePaper.id, hid)}
                  onUpdateHighlight={(hid, patch) => updateHighlight(activePaper.id, hid, patch)}
                />
              ) : (
                <div className="empty">
                  <h3>选一篇论文开始</h3>
                  <p>从左侧论文库点开一篇，即可多标签页阅读、翻译、划线批注；右侧栏记录整篇笔记；顶部切到「论文库总览」看全部论文的表格。</p>
                </div>
              )
            ) : (
              <Library
                papers={state.papers}
                onOpen={(id) => { openPaper(id); setView('reader') }}
                onPatch={(id, patch) => updatePaper(id, patch)}
                onExport={exportData}
                onAddDemo={addDemo}
                onImport={() => setImportOpen(true)}
              />
            )}
          </div>

          {activePaper && view === 'reader' && (
            <NotesPanel
              paper={activePaper}
              onPatch={(patch) => updatePaper(activePaper.id, patch)}
              onHighlightUpdate={(hid, patch) => updateHighlight(activePaper.id, hid, patch)}
              onHighlightRemove={(hid) => removeHighlight(activePaper.id, hid)}
              onDelete={() => removePaper(activePaper.id)}
              onClose={() => patchSettings({ notesCollapsed: true })}
              collapsed={notesCollapsed}
            />
          )}
        </div>
      </div>

      {importOpen && <ImportDialog onClose={() => setImportOpen(false)} onFiles={importFiles} busy={importing} message={importMsg} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
