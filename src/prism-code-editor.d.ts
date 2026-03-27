// Type declarations for prism-code-editor
export type CodeEditorTheme = 
  | 'atom-one-dark'
  | 'dracula'
  | 'github-dark'
  | 'github-dark-dimmed'
  | 'github-light'
  | 'night-owl'
  | 'night-owl-light'
  | 'prism'
  | 'prism-okaidia'
  | 'prism-solarized-light'
  | 'prism-tomorrow'
  | 'prism-twilight'
  | 'vs-code-dark'
  | 'vs-code-light';

declare module 'prism-code-editor/setups' {
  export interface EditorOptions {
    language?: string;
    value?: string;
    lineNumbers?: boolean;
    readOnly?: boolean;
    wordWrap?: boolean;
    rtl?: boolean;
    tabSize?: number;
    insertSpaces?: boolean;
    theme?: string;
  }

  export interface PrismEditor {
    value: string;
    dispose(): void;
    focus(): void;
    update(options?: Partial<EditorOptions>): void;
    setOptions(options?: Partial<EditorOptions>): Promise<void>;
  }

  export function basicEditor(
    container: HTMLElement,
    options?: EditorOptions
  ): PrismEditor;
}

declare module 'prism-code-editor/prism/languages/javascript' {
  const content: any;
  export default content;
}

declare module 'prism-code-editor/themes' {
  export function loadTheme(name: CodeEditorTheme): Promise<string>;
}
