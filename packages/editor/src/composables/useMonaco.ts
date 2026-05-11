import loader from '@monaco-editor/loader'
import type * as Monaco from 'monaco-editor'

self.MonacoEnvironment = {
  getWorker() {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' }
    )
  },
}

export interface UseMonacoOptions {
  value?: string
  language?: string
  readOnly?: boolean
  fontSize?: number
  fontFamily?: string
  tabSize?: number
  wordWrap?: boolean
  minimap?: boolean
}

let monacoInstance: typeof Monaco | null = null
let initPromise: Promise<typeof Monaco> | null = null

async function loadMonaco(): Promise<typeof Monaco> {
  if (monacoInstance) return monacoInstance
  if (initPromise) return initPromise

  initPromise = (async () => {
    const monaco = await import('monaco-editor')
    loader.config({ monaco })
    monacoInstance = (await loader.init()) as typeof Monaco
    return monacoInstance
  })()

  return initPromise
}

export function useMonaco() {
  let editor: Monaco.editor.IStandaloneCodeEditor | null = null

  const monacoRef: { current: typeof Monaco | null } = { current: null }

  async function getMonaco(): Promise<typeof Monaco> {
    if (monacoRef.current) return monacoRef.current
    monacoRef.current = await loadMonaco()
    return monacoRef.current
  }

  async function initMonaco(
    container: HTMLElement,
    options?: UseMonacoOptions
  ): Promise<Monaco.editor.IStandaloneCodeEditor> {
    const monaco = await loadMonaco()
    monacoRef.current = monaco

    editor = monaco.editor.create(container, {
      value: options?.value ?? '',
      language: options?.language ?? 'sql',
      theme: 'vs-dark',
      fontSize: options?.fontSize ?? 14,
      fontFamily: options?.fontFamily ?? "'Cascadia Code', 'Fira Code', 'Consolas', 'Monaco', monospace",
      minimap: { enabled: options?.minimap ?? false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: options?.tabSize ?? 2,
      wordWrap: options?.wordWrap ? 'on' : 'off',
      readOnly: options?.readOnly ?? false,
    })

    return editor
  }

  function getEditor() {
    return editor
  }

  function dispose() {
    editor?.dispose()
    editor = null
    monacoRef.current = null
  }

  return { initMonaco, getEditor, getMonaco, dispose }
}
