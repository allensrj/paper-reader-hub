import { useEffect, useRef, useState } from 'react'
import type { Highlight } from '../types'
import { overlayOf } from '../lib/colors'
import { getPdfjsApi } from '../lib/pdf'

const hexOf = overlayOf

function dpr(): number {
  return Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1)
}

async function legacyTextLayer(pdfjs: any, page: any, viewport: any, container: HTMLDivElement): Promise<void> {
  const content = await page.getTextContent()
  for (const item of (content.items || []) as any[]) {
    if (typeof item.str !== 'string' || !item.str) continue
    const tx = pdfjs.Util.transform(viewport.transform, item.transform || [1, 0, 0, 1, 0, 0])
    const fontH = Math.hypot(tx[2], tx[3]) || 10
    const span = document.createElement('span')
    span.textContent = item.str
    span.style.position = 'absolute'
    span.style.left = tx[4] + 'px'
    span.style.top = tx[5] - fontH + 'px'
    span.style.fontSize = fontH + 'px'
    span.style.color = 'transparent'
    container.appendChild(span)
  }
}

export interface PdfStageProps {
  doc: any
  targetWidth: number
  aspect: number
  highlights: Highlight[]
  onHlClick: (hid: string, clientX: number, clientY: number) => void
  onPageRatio: (page: number, ratio: number) => void
  /** 刚从右侧译文跳过来的段落位置（0~1），闪一下高亮 */
  focus?: { page: number; top: number; bottom: number } | null
}

export function PdfStage(props: PdfStageProps) {
  const { doc, targetWidth, aspect, highlights, onHlClick, onPageRatio, focus } = props
  const pages: number[] = []
  for (let i = 1; i <= doc.numPages; i++) pages.push(i)
  return (
    <div className="pdf-stage">
      {pages.map((n) => (
        <PdfPageView
          key={n}
          doc={doc}
          num={n}
          targetWidth={targetWidth}
          aspect={aspect}
          highlights={highlights.filter((h) => h.page === n)}
          onHlClick={onHlClick}
          onRatio={onPageRatio}
          focus={focus && focus.page === n ? focus : null}
        />
      ))}
    </div>
  )
}

interface PageProps {
  doc: any
  num: number
  targetWidth: number
  aspect: number
  highlights: Highlight[]
  onHlClick: (hid: string, clientX: number, clientY: number) => void
  onRatio: (page: number, ratio: number) => void
  focus: { page: number; top: number; bottom: number } | null
}

function PdfPageView(props: PageProps) {
  const { doc, num, targetWidth, aspect, highlights, onHlClick, onRatio, focus } = props
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const taskRef = useRef<any>(null)
  const seqRef = useRef(0)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [near, setNear] = useState(num <= 2)

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setNear(true)
            io.disconnect()
          }
        }
      },
      { rootMargin: '2000px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) onRatio(num, e.intersectionRatio)
      },
      { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [num, onRatio])

  useEffect(() => {
    if (!near || !doc) return
    const seq = ++seqRef.current
    let alive = true
    const stillCurrent = () => alive && seq === seqRef.current

    ;(async () => {
      // 上一轮可能还在画：先取消并等它收尾，否则新的一轮会重置同一个 canvas，
      // 让上一轮残留的绘制用错变换，出现首页倒置/镜像。
      const prev = taskRef.current
      if (prev) {
        taskRef.current = null
        try {
          prev.cancel()
        } catch {
          /* ignore */
        }
        try {
          await prev.promise
        } catch {
          /* cancelled */
        }
      }
      try {
        const page = await doc.getPage(num)
        if (!stillCurrent()) return
        const base = page.getViewport({ scale: 1 })
        const scale = targetWidth / base.width
        const vp = page.getViewport({ scale })
        setDims({ w: vp.width, h: vp.height })
        const canvas = canvasRef.current
        if (!canvas) return
        const rvp = page.getViewport({ scale: scale * dpr() })
        canvas.width = Math.floor(rvp.width)
        canvas.height = Math.floor(rvp.height)
        canvas.style.width = vp.width + 'px'
        canvas.style.height = vp.height + 'px'
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.save()
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
        let task = page.render({ canvasContext: ctx, viewport: rvp })
        taskRef.current = task
        try {
          await task.promise
        } catch (err: any) {
          // 极端情况下上一轮的渲染还没释放 canvas，pdf.js 会拒绝这次渲染；
          // 稍等一拍再试一次，避免整页留白。
          if (!/same canvas/i.test(String(err && err.message))) throw err
          await new Promise((r) => setTimeout(r, 60))
          if (!stillCurrent()) return
          const c2 = canvasRef.current
          if (!c2) return
          const ctx2 = c2.getContext('2d')
          if (!ctx2) return
          task = page.render({ canvasContext: ctx2, viewport: rvp })
          taskRef.current = task
          await task.promise
        }
        if (taskRef.current === task) taskRef.current = null
        if (!stillCurrent()) return
        const textEl = textRef.current
        const pdfjs: any = await getPdfjsApi()
        if (!textEl || !stillCurrent()) return
        textEl.innerHTML = ''
        // pdf.js 的 TextLayer 用 calc(var(--scale-factor) * Npx) 定位每段文字：
        // 不把 --scale-factor 设上去，字号会退回默认值，文字层每行只有左边一小段可选中。
        textEl.style.setProperty('--scale-factor', String(vp.scale))
        textEl.style.width = vp.width + 'px'
        textEl.style.height = vp.height + 'px'
        if (typeof pdfjs.TextLayer === 'function') {
          const layer = new pdfjs.TextLayer({
            textContentSource: page.streamTextContent(),
            container: textEl,
            viewport: vp,
          })
          await layer.render()
        } else {
          await legacyTextLayer(pdfjs, page, vp, textEl)
        }
      } catch (err) {
        if (stillCurrent()) console.warn('render page failed', num, err)
      }
    })()
    return () => {
      alive = false
      // 不在这里清空 taskRef：把取消掉的渲染留给下一轮 await 收尾，
      // 否则新渲染会在旧渲染还没释放 canvas 时就开始，画面上出现上一轮的残留。
      const task = taskRef.current
      if (task) {
        try {
          task.cancel()
        } catch {
          /* ignore */
        }
      }
    }
  }, [near, doc, num, targetWidth])

  const w = dims ? dims.w : targetWidth
  const h = dims ? dims.h : targetWidth * aspect

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 双击（查词）时不要弹出划线菜单，否则会打断取词
    if (e.detail > 1) return
    // 正在选词/选句时不要弹出划线菜单，否则双击查词会被打断
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.toString().trim()) return
    const box = e.currentTarget.getBoundingClientRect()
    const nx = (e.clientX - box.left) / box.width
    const ny = (e.clientY - box.top) / box.height
    for (let i = highlights.length - 1; i >= 0; i--) {
      const hl = highlights[i]
      for (const r of hl.rects || []) {
        const pad = 0.005
        if (nx >= r.x - pad && nx <= r.x + r.w + pad && ny >= r.y - pad && ny <= r.y + r.h + pad) {
          e.stopPropagation()
          onHlClick(hl.id, e.clientX, e.clientY)
          return
        }
      }
    }
  }

  return (
    <div className="pdfpage" data-page={num} ref={wrapRef} style={{ width: w, height: h }} onClick={handleClick}>
      <canvas ref={canvasRef} className="pdfcanvas" />
      <div className="hl-layer">
        {highlights.map((hl) =>
          (hl.rects || []).map((r, i) => (
            <div
              key={hl.id + ':' + i}
              className={'hl-rect' + (hl.note ? ' has-note' : '')}
              data-hl={hl.id}
              style={{ left: r.x * w, top: r.y * h, width: r.w * w, height: r.h * h, background: hexOf(hl.color) }}
            />
          )),
        )}
      </div>
      {focus && (
        <div
          className="page-focus"
          style={{ top: focus.top * h, height: Math.max(8, (focus.bottom - focus.top) * h) }}
        />
      )}
      <div className="textLayer" ref={textRef} />
      <span className="page-badge">P{num}</span>
    </div>
  )
}
