import { useRef, useState } from 'react'

interface Props {
  onClose: () => void
  onFiles: (files: FileList | File[]) => void
  busy: boolean
  message: string
}

export default function ImportDialog(props: Props) {
  const { onClose, onFiles, busy, message } = props
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>导入论文 PDF</header>
        <div className="content">
          <div
            className={'drop-zone' + (over ? ' over' : '')}
            style={{ padding: 36 }}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files)
            }}
            onClick={() => inputRef.current?.click()}
          >
            <div style={{ fontSize: 24, marginBottom: 8 }}>⤓</div>
            点击选择，或把多个 PDF 拖到这里
            <div style={{ marginTop: 6, fontSize: 11 }}>支持批量；文本层会被抽取以便翻译、划线与批注</div>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length) onFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <div className="hint">
            · PDF 原文件保存在浏览器 IndexedDB，抽取出的文字与笔记存在 localStorage。<br />
            · 扫描版 PDF 没有文字层，只能看原版页面，无法翻译与划线。<br />
            · 所有数据都在本机，不会上传服务器（翻译引擎除外）。
          </div>
          {message && <div style={{ fontSize: 12.5, color: message.startsWith('✕') ? 'var(--rose)' : 'var(--accent)' }}>{message}</div>}
        </div>
        <footer>
          <button className="btn ghost" onClick={onClose} disabled={busy}>关闭</button>
        </footer>
      </div>
    </div>
  )
}
