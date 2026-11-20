import { useState } from 'react'
import type { Highlight, HighlightColor, Paper } from '../types'
import { COLORS } from '../lib/colors'

interface Props {
  paper: Paper
  onPatch: (patch: Partial<Paper>) => void
  onHighlightUpdate: (hid: string, patch: Partial<Highlight>) => void
  onHighlightRemove: (hid: string) => void
  onDelete: () => void
  onClose: () => void
  /** 收起时宽度归零（外面用「◧ 笔记」或这里点 ⇥ 都能切） */
  collapsed?: boolean
}

export default function NotesPanel(props: Props) {
  const { paper, onPatch, onHighlightUpdate, onHighlightRemove, onDelete, onClose, collapsed } = props
  const [tagInput, setTagInput] = useState('')

  const addTag = () => {
    const t = tagInput.trim()
    if (!t || paper.tags.includes(t)) {
      setTagInput('')
      return
    }
    onPatch({ tags: [...paper.tags, t] })
    setTagInput('')
  }

  return (
    <aside className={'notes' + (collapsed ? ' collapsed' : '')} aria-hidden={collapsed ? true : undefined}>
      <div className="notes-head">
        <strong style={{ fontSize: 12.5 }}>论文笔记</strong>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>自动保存</span>
        <div className="spacer" />
        <button className="btn ghost sm" onClick={onClose} title="收起右侧栏">
          ⇥
        </button>
      </div>

      <div className="notes-scroll">
        <div className="field">
          <label>标签</label>
          <div className="chip-row" style={{ marginBottom: 6 }}>
            {paper.tags.map((t) => (
              <span key={t} className="chip on">
                {t}
                <button
                  onClick={() => onPatch({ tags: paper.tags.filter((x) => x !== t) })}
                  style={{ border: 0, background: 'transparent', color: 'var(--accent)', marginLeft: 4, cursor: 'pointer' }}
                >
                  ×
                </button>
              </span>
            ))}
            {paper.tags.length === 0 && <span className="hint">还没有标签</span>}
          </div>
          <input
            type="text"
            value={tagInput}
            placeholder="输入标签后回车"
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTag()
            }}
          />
        </div>

        <div className="field">
          <label>一句话摘要</label>
          <textarea
            value={paper.summary}
            placeholder="这篇论文解决了什么问题、用了什么方法、结论是什么？"
            style={{ minHeight: 70 }}
            onChange={(e) => onPatch({ summary: e.target.value })}
          />
        </div>

        <div className="field">
          <label>整篇笔记</label>
          <textarea
            className="notes-area"
            value={paper.notes}
            placeholder={'随手记：\
· 核心贡献\
· 方法细节\
· 存疑之处\
· 与其它论文的关系'}
            onChange={(e) => onPatch({ notes: e.target.value })}
          />
        </div>

        <div className="field">
          <label>划线批注 · {paper.highlights.length}</label>
          {paper.highlights.length === 0 && (
            <div className="hint">在正文中选中文字即可划线，选「评论」可直接写批注。</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paper.highlights
              .slice()
              .sort((a, b) => a.page - b.page)
              .map((h) => (
                <div className="hl-card" key={h.id}>
                  <div className={'quote ' + h.color}>{h.text}</div>
                  <textarea
                    className="note-input"
                    value={h.note}
                    placeholder="针对这句写评论…"
                    onChange={(e) => onHighlightUpdate(h.id, { note: e.target.value })}
                  />
                  <div className="foot">
                    <span>P{h.page}</span>
                    <div className="color-dots">
                      {COLORS.map((c) => (
                        <button
                          key={c.key}
                          title={'改为' + c.label}
                          className={'swatch sm' + (h.color === c.key ? ' on' : '')}
                          style={{ background: c.hex }}
                          onClick={() => onHighlightUpdate(h.id, { color: c.key as HighlightColor })}
                        />
                      ))}
                    </div>
                    <div className="spacer" />
                    <button className="btn ghost sm" style={{ color: 'var(--rose)' }} onClick={() => onHighlightRemove(h.id)}>
                      取消划线
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <button className="btn danger sm" onClick={onDelete}>
            从论文库删除这篇
          </button>
        </div>
      </div>
    </aside>
  )
}
