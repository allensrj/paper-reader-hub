import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Paper } from '../types'

interface Props {
  papers: Paper[]
  activeId: string
  collapsed: boolean
  importing: boolean
  onOpen: (id: string) => void
  onImport: () => void
  onDropFiles: (files: FileList) => void
  onAddDemo: () => void
  onDelete: (id: string) => void
}

interface MenuState {
  id: string
  title: string
  x: number
  y: number
}

const MENU_W = 168
const MENU_H = 86

export default function Sidebar(props: Props) {
  const { papers, activeId, collapsed, importing, onOpen, onImport, onDropFiles, onAddDemo, onDelete } = props
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [menu, setMenu] = useState<MenuState | null>(null)

  const tags = useMemo(() => {
    const counter = new Map<string, number>()
    for (const p of papers) for (const t of p.tags) counter.set(t, (counter.get(t) || 0) + 1)
    return Array.from(counter.entries()).sort((a, b) => b[1] - a[1]).slice(0, 14)
  }, [papers])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = papers.filter((p) => {
      if (tag && !p.tags.includes(tag)) return false
      if (!q) return true
      return (
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.tags.join(' ').toLowerCase().includes(q) ||
        p.notes.toLowerCase().includes(q)
      )
    })
    return list.slice().sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt))
  }, [papers, query, tag])

  // 右键菜单：点空白处、按 Esc、滚动或改变窗口大小都收起
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const openMenu = (e: React.MouseEvent, p: Paper) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - MENU_W - 8)
    const y = Math.min(e.clientY, window.innerHeight - MENU_H - 8)
    setMenu({ id: p.id, title: p.title, x: Math.max(8, x), y: Math.max(8, y) })
  }

  return (
    <aside className={'sidebar' + (collapsed ? ' collapsed' : '')}>
      <div className="sidebar-head">
        <div className="search">
          <span style={{ color: 'var(--ink-3)' }}>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索标题 / 作者 / 标签 / 笔记" />
          {query && (
            <button className="btn ghost sm" onClick={() => setQuery('')} style={{ padding: '0 4px' }}>
              ✕
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn primary" style={{ flex: 1 }} onClick={onImport} disabled={importing}>
            {importing ? '解析中…' : '+ 导入 PDF'}
          </button>
          <button className="btn" onClick={onAddDemo} title="添加示例论文">
            示例
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        {tags.length > 0 && (
          <div className="chip-row" style={{ padding: '4px 4px 10px' }}>
            <button className={'chip' + (tag === '' ? ' on' : '')} onClick={() => setTag('')}>
              全部 {papers.length}
            </button>
            {tags.map(([t, n]) => (
              <button key={t} className={'chip' + (tag === t ? ' on' : '')} onClick={() => setTag(tag === t ? '' : t)}>
                {t} {n}
              </button>
            ))}
          </div>
        )}

        <div className="paper-list">
          {filtered.map((p) => (
            <div
              key={p.id}
              className={'paper-item' + (p.id === activeId ? ' active' : '')}
              onClick={() => {
                setMenu(null)
                onOpen(p.id)
              }}
              onContextMenu={(e) => openMenu(e, p)}
              title={p.title + '（右键可删除）'}
            >
              <div className="ptitle">{p.title}</div>
              <div className="pmeta">
                <span>{p.authors.split(',')[0]}</span>
                <span>·</span>
                <span>{p.year}</span>
                {p.highlights.length > 0 && <span style={{ marginLeft: 'auto' }}>✎{p.highlights.length}</span>}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', padding: '6px 10px' }}>没有匹配的论文</div>
          )}
        </div>

        <div
          className={'drop-zone' + (dragOver ? ' over' : '')}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            if (e.dataTransfer.files && e.dataTransfer.files.length) onDropFiles(e.dataTransfer.files)
          }}
          onClick={onImport}
        >
          把 PDF 拖到这里导入
          <div style={{ marginTop: 4, fontSize: 11 }}>文件保存在浏览器本地，不上传</div>
        </div>
      </div>

      {menu &&
        createPortal(
          <div className="ctx-menu" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
            <div className="ctx-head">{menu.title}</div>
            <button
              className="ctx-item"
              onClick={() => {
                const id = menu.id
                setMenu(null)
                onOpen(id)
              }}
            >
              打开
            </button>
            <button
              className="ctx-item danger"
              onClick={() => {
                const id = menu.id
                setMenu(null)
                onDelete(id)
              }}
            >
              删除这篇论文
            </button>
          </div>,
          document.body,
        )}
    </aside>
  )
}
