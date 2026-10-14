// MATLAB code editor (CodeMirror 6 with the Octave/MATLAB syntax mode).
// Bundled with the app, so it works offline. Ctrl+Enter runs the code;
// the line of the last MATLAB error is highlighted.
import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, keymap, Decoration } from '@codemirror/view'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { indentWithTab } from '@codemirror/commands'
import { HighlightStyle, StreamLanguage, syntaxHighlighting, indentUnit } from '@codemirror/language'
import { octave } from '@codemirror/legacy-modes/mode/octave'
import { tags as t } from '@lezer/highlight'

// Same palette as the read-only code blocks (pre.code)
const matlabHighlight = HighlightStyle.define([
  { tag: t.keyword, color: '#7cc4ff', fontWeight: '600' },
  { tag: t.comment, color: '#8fd19e', fontStyle: 'italic' },
  { tag: t.string, color: '#f2b880' },
  { tag: t.number, color: '#d7a6ff' },
  { tag: [t.operator, t.bracket], color: '#c8d3e3' },
  { tag: t.variableName, color: '#e6edf6' },
  { tag: t.standard(t.variableName), color: '#ffd479' },     // built-in functions (zeros, size, imshow ...)
  { tag: t.invalid, color: '#ff8080' },
])

const editorTheme = EditorView.theme({
  '&': { backgroundColor: '#141c2b', color: '#e6edf6', fontSize: '13.5px', borderRadius: '12px', height: '100%' },
  '.cm-scroller': { fontFamily: "Consolas, 'Cascadia Mono', monospace", lineHeight: '1.6' },
  '.cm-content': { caretColor: '#ffffff', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#ffffff' },
  '&.cm-focused': { outline: '2px solid #2f7de1', outlineOffset: '-2px' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#2c4a7a !important' },
  '.cm-gutters': { backgroundColor: '#101724', color: '#5d6b82', border: 'none', borderRadius: '12px 0 0 12px' },
  '.cm-activeLine': { backgroundColor: '#1b2538' },
  '.cm-activeLineGutter': { backgroundColor: '#1b2538', color: '#a9b6ca' },
  '.cm-matchingBracket': { backgroundColor: '#2c4a7a', outline: 'none' },
  '.cm-error-line': { backgroundColor: 'rgba(209, 72, 72, 0.28)' },
  '.cm-tooltip': { backgroundColor: '#1b2538', color: '#e6edf6', border: '1px solid #2a3953' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#2c4a7a' },
  '.cm-panels': { backgroundColor: '#101724', color: '#e6edf6' },
}, { dark: true })

// Highlight of the line where MATLAB reported an error
const setErrorLine = StateEffect.define()
const errorLineField = StateField.define({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setErrorLine)) {
        const n = e.value
        deco = n && n >= 1 && n <= tr.state.doc.lines
          ? Decoration.set([Decoration.line({ class: 'cm-error-line' }).range(tr.state.doc.line(n).from)])
          : Decoration.none
      }
    }
    return tr.docChanged ? Decoration.none : deco      // editing clears the mark
  },
  provide: (f) => EditorView.decorations.from(f),
})

export default function MatlabEditor({ value, onChange, onRun, errorLine, height = 380, label = 'MATLAB code' }) {
  const host = useRef(null)
  const view = useRef(null)
  const handlers = useRef({ onChange, onRun })
  handlers.current = { onChange, onRun }

  useEffect(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        StreamLanguage.define(octave),
        syntaxHighlighting(matlabHighlight),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        keymap.of([
          { key: 'Mod-Enter', preventDefault: true, run: () => { handlers.current.onRun?.(); return true } },
          indentWithTab,
        ]),
        editorTheme,
        errorLineField,
        EditorView.contentAttributes.of({ 'aria-label': label }),
        EditorView.updateListener.of((u) => { if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString()) }),
      ],
    })
    view.current = new EditorView({ state, parent: host.current })
    return () => view.current.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Replace the text when it changes from outside (new task, reset, solution)
  useEffect(() => {
    const v = view.current
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }
  }, [value])

  useEffect(() => {
    view.current?.dispatch({ effects: setErrorLine.of(errorLine || null) })
    if (errorLine && view.current && errorLine <= view.current.state.doc.lines) {
      view.current.dispatch({ effects: EditorView.scrollIntoView(view.current.state.doc.line(errorLine).from, { y: 'center' }) })
    }
  }, [errorLine])

  return <div className="matlab-editor" ref={host} style={{ height }} />
}
