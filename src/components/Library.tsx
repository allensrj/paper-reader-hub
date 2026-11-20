import { useMemo, useState } from 'react'
import type { Paper } from '../types'
import { COLORS } from '../lib/colors'

interface Props {
  papers: Paper[]
  onOpen: (id: string) => void
  onPatch: (id: string, patch: Partial<Paper>) => void
  onExport: (kind: 'json' | 'csv') => void
  onAddDemo: () => void
  onImport: () => void
}

type SortKey = 'title' | 'year' | 'done' | 'highlights' | 'notes' | 'updatedAt'

function fmtDate(ms: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function Library(props: Props) {
  const { papers, onOpen, onPatch, onExport, onAddDemo, onImport } = props
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [asc, setAsc] = useState(false)
  const [q, setQ] = useState('')
  const [onlyDone, setOnlyDone] = useState<boolean | null>(null)
  const [expanded, setExpanded] = useState<string>('')

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    const filtered = papers.filter((p) => {
      if (onlyDone !== null && (p.status === 'done') !== onlyDone) return false
      if (!query) return true
      return (
        p.title.toLowerCase().includes(query) ||
        p.authors.toLowerCase().includes(query) ||
        p.tags.join(' ').toLowerCase().includes(query) ||
        p.summary.toLowerCase().includes(query) ||
        p.notes.toLowerCase().includes(query)
      )
    })
    const val = (p: Paper): number | string => {
      switch (sortKey) {
        case 'title': return p.title.toLowerCase()
        case 'year': return Number(p.year) || 0
        case 'done': return p.status === 'done' ? 1 : 0
        case 'highlights': return p.highlights.length
        case 'notes': return (p.notes + p.summary).length
        default: return p.updatedAt
      }
    }
    return filtered.slice().sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      if (va === vb) return 0
      const cmp = va > vb ? 1 : -1
      return asc ? cmp : -cmp
    })
  }, [papers, sortKey, asc, onlyDone, q])

  const stats = useMemo(() => {
    const total = papers.length
    const done = papers.filter((p) => p.status === 'done').length
    const highlights = papers.reduce((n, p) => n + p.highlights.length, 0)
    const words = papers.reduce((n, p) => n + (p.notes.length + p.summary.length), 0)
    return { total, done, todo: total - done, highlights, words }
  }, [papers])

  const tagStats = useMemo(() => {
    const counter = new Map<string, number>()
    for (const p of papers) for (const t of p.tags) counter.set(t, (counter.get(t) || 0) + 1)
    return Array.from(counter.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [papers])

  const th = (key: SortKey, label: string) => (
    <th
      onClick={() => {
        if (sortKey === key) setAsc(!asc)
        else {
          setSortKey(key)
          setAsc(false)
        }
      }}
    >
      {label}
      {sortKey === key && <span style={{ marginLeft: 4 }}>{asc ? '↑' : '↓'}</span>}
    </th>
  )

  if (papers.length === 0) {
    return (
      <div className="empty">
        <h3>论文库还是空的</h3>
        <p>导入 PDF 或先加载几篇示例论文，就能在这里看到全部论文的总览表格：标题、作者、读完标记、笔记与划线统计。</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button className="btn primary" onClick={onImport}>导入 PDF</button>
          <button className="btn" onClick={onAddDemo}>加载示例论文</button>
        </div>
      </div>
    )
  }

  return (
    <div className="library">
      <div className="stats">
        <div className="stat"><div className="k">论文总数</div><div className="v">{stats.total}<small>篇</small></div></div>
        <div className="stat"><div className="k">已读完</div><div className="v">{stats.done}<small>篇</small></div></div>
        <div className="stat"><div className="k">未读完</div><div className="v">{stats.todo}<small>篇</small></div></div>
        <div className="stat"><div className="k">划线批注</div><div className="v">{stats.highlights}<small>条</small></div></div>
        <div className="stat"><div className="k">笔记字数</div><div className="v">{stats.words}<small>字</small></div></div>
      </div>

      {tagStats.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 650, color: 'var(--ink-3)', letterSpacing: '.05em', textTransform: 'uppercase' }}>主题分布</span>
          {tagStats.map(([t, n]) => (
            <span key={t} className="chip">
              {t}
              <i style={{ marginLeft: 5, opacity: .6 }}>{n}</i>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search" style={{ width: 260 }}>
          <span style={{ color: 'var(--ink-3)' }}>⌕</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="在全部笔记中搜索" />
        </div>
        <div className="seg">
          {([[null, '全部'], [false, '未读完'], [true, '已读完']] as Array<[boolean | null, string]>).map(([k, label]) => (
            <button key={label} className={onlyDone === k ? 'active' : ''} onClick={() => setOnlyDone(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <span className="hint">{rows.length} 篇 · 点标题打开</span>
        <button className="btn sm" onClick={() => onExport('csv')}>导出 CSV</button>
        <button className="btn sm" onClick={() => onExport('json')}>导出 JSON</button>
      </div>

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              {th('done', '读完')}
              {th('title', '论文')}
              {th('year', '年份')}
              <th>标签</th>
              {th('highlights', '划线')}
              {th('notes', '笔记 / 摘要')}
              {th('updatedAt', '更新')}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={expanded === p.id ? 'sel' : ''}>
                <td style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    className="read-check"
                    checked={p.status === 'done'}
                    title={p.status === 'done' ? '标记为未读完' : '标记为已读完'}
                    onChange={(e) => onPatch(p.id, { status: e.target.checked ? 'done' : 'unread' })}
                  />
                </td>
                <td onClick={() => setExpanded(expanded === p.id ? '' : p.id)} style={{ cursor: 'pointer' }}>
                  <div className="cell-title">
                    {p.title}
                    <small>{p.authors} · {p.venue}</small>
                  </div>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>{p.year}</td>
                <td>
                  <div className="chip-row">
                    {p.tags.slice(0, 2).map((t) => (
                      <span key={t} className="chip">{t}</span>
                    ))}
                  </div>
                </td>
                <td>{p.highlights.length}</td>
                <td onClick={() => setExpanded(expanded === p.id ? '' : p.id)} style={{ cursor: 'pointer' }}>
                  <div className="cell-note">{p.summary || p.notes || '—'}</div>
                </td>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--ink-3)', fontSize: 11.5 }}>{fmtDate(p.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {expanded && papers.some((p) => p.id === expanded) && (
        <ExpandedCard
          paper={papers.find((p) => p.id === expanded)!}
          onPatch={(patch) => onPatch(expanded, patch)}
          onOpen={() => onOpen(expanded)}
          onClose={() => setExpanded('')}
        />
      )}
    </div>
  )
}

function ExpandedCard(props: { paper: Paper; onPatch: (patch: Partial<Paper>) => void; onOpen: () => void; onClose: () => void }) {
  const { paper, onPatch, onOpen, onClose } = props
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1 }}>{paper.title}</span>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input
              type="checkbox"
              className="read-check"
              checked={paper.status === 'done'}
              onChange={(e) => onPatch({ status: e.target.checked ? 'done' : 'unread' })}
            />
            已读完
          </label>
        </header>
        <div className="content">
          <div className="hint">{paper.authors} · {paper.venue} {paper.year} · {paper.pageCount} 页</div>
          <div className="field">
            <label>摘要</label>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--ink-2)' }}>{paper.summary || '—'}</div>
          </div>
          <div className="field">
            <label>笔记</label>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--ink-2)', background: 'var(--panel-soft)', borderRadius: 8, padding: 10 }}>
              {paper.notes || '—'}
            </div>
          </div>
          <div className="field">
            <label>划线批注 · {paper.highlights.length}</label>
            {paper.highlights.length === 0 && <div className="hint">暂无</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {paper.highlights.map((h) => (
                <div className="hl-card" key={h.id}>
                  <div className={'quote ' + h.color}>{h.text}</div>
                  {h.note && <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>💬 {h.note}</div>}
                  <div className="foot">P{h.page} · {COLORS.find((c) => c.key === h.color)?.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <footer>
          <button className="btn ghost" onClick={onClose}>关闭</button>
          <button className="btn primary" onClick={onOpen}>打开阅读</button>
        </footer>
      </div>
    </div>
  )
}
