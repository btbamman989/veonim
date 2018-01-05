import { h, app, style, Actions, vimBlur, vimFocus } from '../ui/uikit'
import { DiagnosticSeverity } from 'vscode-languageserver-types'
import { Row, RowHeader, RowGroup } from '../styles/common'
import * as canvasContainer from '../core/canvas-container'
import { QuickfixGroup } from '../ai/diagnostics'
import { cmd, feedkeys } from '../core/neovim'
import Input from '../components/text-input'
import { filter } from 'fuzzaldrin-plus'
import Icon from '../components/icon'
import { join } from 'path'

interface State {
  focus: boolean,
  val: string,
  problems: QuickfixGroup[],
  cache: QuickfixGroup[],
  vis: boolean,
  ix: number,
  subix: number,
}

let elref: HTMLElement
const SCROLL_AMOUNT = 0.25
const els = new Map<number, HTMLElement>()

// scroll after next section has been rendered as expanded (a little hacky)
const scrollIntoView = (next: number) => setTimeout(() => {
  const { top: containerTop, bottom: containerBottom } = elref.getBoundingClientRect()
  const e = els.get(next)
  if (!e) return

  const { top, height } = e.getBoundingClientRect()

  if (top + height > containerBottom) {
    const offset = top - containerBottom

    if (offset < containerTop) elref.scrollTop += top - containerTop
    else elref.scrollTop += offset + height + containerTop + 50
  }

  else if (top < containerTop) elref.scrollTop += top - containerTop
}, 1)

const selectResult = (results: QuickfixGroup[], ix: number, subix: number) => {
  if (subix < 0) return
  const group: QuickfixGroup = Reflect.get(results, ix)
  if (!group) return
  const { file, dir, items } = group
  const { range: { start: { line, character } } } = items[subix]

  const path = join(dir, file)
  cmd(`e ${path}`)
  feedkeys(`${line + 1}Gzz${character + 1}|`)
}

const state: State = {
  focus: false,
  val: '',
  problems: [],
  cache: [],
  vis: false,
  ix: 0,
  subix: 0,
}

const IconBox = style('div')({
  display: 'flex',
  alignItems: 'center',
  paddingRight: '10px',
})

const icons = {
  [DiagnosticSeverity.Error]: Icon('error', {
    color: '#ef2f2f',
    size: canvasContainer.font.size + 4,
  }),
  [DiagnosticSeverity.Warning]: Icon('error', {
    color: '#ffb100',
    size: canvasContainer.font.size + 4,
  })
}

const getSeverityIcon = (severity = 1) => Reflect.get(icons, severity)

const view = ({ val, focus, problems, vis, ix, subix }: State, { change, blur, next, prev, nextGroup, prevGroup, scrollDown, scrollUp }: any) => h('#quickfix', {
  onupdate: (e: HTMLElement) => elref = e,
  style: {
    // TODO: vim colors
    background: '#222',
    color: '#eee',
    display: vis ? 'flex' : 'none',
    flexFlow: 'column',
    position: 'absolute',
    alignSelf: 'flex-end',
    // TODO: enable once we have scrolling implemented
    //maxHeight: '30vh',
    width: '100%',
  }
}, [
  ,h('div', {
    style: {
      paddingLeft: '10px',
      paddingRight: '10px',
      paddingBottom: '8px',
      paddingTop: '8px',
    }
  }, 'Problems')

  ,Input({
    val,
    change,
    focus,
    next,
    prev,
    nextGroup,
    prevGroup,
    hide: blur,
    down: scrollDown,
    up: scrollUp,
    icon: 'search',
    desc: 'search problems',
  })

  ,h('div', problems.map(({ file, dir, items }, pos) => h('div', {
    oncreate: (e: HTMLElement) => els.set(pos, e),
  }, [

    ,RowHeader({
      // TODO: make this shared - grep needs it also
      style: pos === ix && {
        color: '#fff',
        background: '#5a5a5a',
        fontWeight: 'normal',
      }
    }, [
      ,h('span', file),
      ,h('span', dir),
      ,h('span.bubble', { style: { 'margin-left': '12px' } }, items.length)
    ])

    ,pos === ix && RowGroup({}, items.map(({ severity, message, range }, itemPos) => Row({
      // TODO: how to make this shared
      style: itemPos === subix && {
        background: '#3f3f3f',
        color: '#eee',
        fontWeight: 'bold',
      }
    }, [
      ,IconBox({}, getSeverityIcon(severity))

      ,h('span', message)
      ,h('span', {
        style: { marginLeft: '10px' }
      }, `(${range.start.line}, ${range.start.character})`)
    ])))

  ])))
])

const a: Actions<State> = {}

a.toggle = s => ({ vis: !s.vis })
a.blur = () => (vimFocus(), { focus: false })
a.focus = () => (vimBlur(), { focus: true, vis: true })
a.updateProblems = (_s, _a, problems) => ({ problems, cache: problems })

a.change = (s, _a, val: string) => ({ val, problems: val
  ? filter(s.problems, val, { key: 'file' })
  : s.cache
})

a.nextGroup = s => {
  const next = s.ix + 1 > s.problems.length - 1 ? 0 : s.ix + 1
  scrollIntoView(next)
  return { subix: -1, ix: next }
}

a.prevGroup = s => {
  const next = s.ix - 1 < 0 ? s.problems.length - 1 : s.ix - 1
  scrollIntoView(next)
  return { subix: -1, ix: next }
}

a.next = s => {
  const items = (Reflect.get(s.problems, s.ix) || {}).items || []
  const next = s.subix + 1 < items.length ? s.subix + 1 : 0
  selectResult(s.problems, s.ix, next)
  return { subix: next }
}

a.prev = s => {
  const items = (Reflect.get(s.problems, s.ix) || {}).items || []
  const prev = s.subix - 1 < 0 ? items.length - 1 : s.subix - 1
  selectResult(s.problems, s.ix, prev)
  return { subix: prev }
}

a.scrollDown = () => {
  const { height } = elref.getBoundingClientRect()
  elref.scrollTop += Math.floor(height * SCROLL_AMOUNT)
}

a.scrollUp = () => {
  const { height } = elref.getBoundingClientRect()
  elref.scrollTop -= Math.floor(height * SCROLL_AMOUNT)
}

const ui = app({ state, view, actions: a }, false)

export const hide = () => ui.hide()
export const focus = () => ui.focus()
export const toggle = () => ui.toggle()
export const update = (problems: QuickfixGroup[]) => ui.updateProblems(problems)