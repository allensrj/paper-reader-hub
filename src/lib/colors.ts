import type { HighlightColor } from '../types'

/** label/hex 用于笔记卡片的小色点；overlay 是压在 PDF 上的实际划线色（更饱和，能压住黑字） */
export const COLORS: Array<{ key: HighlightColor; label: string; hex: string; overlay: string }> = [
  { key: 'yellow', label: '黄色', hex: '#f3d34a', overlay: '#ffd93d' },
  { key: 'green', label: '绿色', hex: '#66c48d', overlay: '#7bd99b' },
  { key: 'blue', label: '蓝色', hex: '#6aa9e0', overlay: '#8dc3ef' },
  { key: 'pink', label: '粉色', hex: '#e88aa6', overlay: '#f6a8c0' },
]

export function overlayOf(key: string): string {
  const c = COLORS.find((x) => x.key === key) || COLORS[0]
  return c.overlay
}
