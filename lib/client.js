// 论文知识库学习看板 · DeepSeek Harness 插件：浏览器半边
// 侧栏加一个「论文看板」入口，主区域是该看板页面（/paper-board/，iframe）。
window.__ModuleLoader__.load({
  id: 'dsh-paper-board',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const h = React.createElement
    const PANEL = 'paper-board'
    const SRC = '/paper-board/'

    // 侧栏图标：一摞论文 + 一行笔记
    function BoardIcon(props) {
      const s = (props && props.size) || 18
      return h('svg', { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinejoin: 'round', strokeLinecap: 'round' },
        h('path', { d: 'M6 3h9l3 3v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' }),
        h('path', { d: 'M8 8h6M8 11h6M8 14h3' }),
        h('path', { d: 'M4 17v2a2 2 0 0 0 2 2h8' }))
    }

    function BoardPanel() {
      return h('iframe', {
        src: SRC,
        title: '论文看板',
        allow: 'fullscreen',
        style: { width: '100%', height: '100%', border: 0, display: 'block', background: 'transparent' },
      })
    }

    function apply(ctx) {
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 7, label: () => '论文看板' }, BoardIcon))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, BoardPanel))
    }

    exports.isPlugin = true
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
