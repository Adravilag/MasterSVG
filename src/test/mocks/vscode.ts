/**
 * Mock de VS Code API para tests unitarios
 * Simula las funcionalidades más usadas de la API de VS Code
 */

export const workspace = {
  workspaceFolders: [
    {
      uri: { fsPath: '/test/workspace' },
      name: 'test-workspace',
      index: 0
    }
  ],
  
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        'componentName': 'Icon',
        'componentImport': '@/components/ui/Icon',
        'svgFolders': ['src/assets/icons'],
        'outputFormat': 'jsx',
        'iconNameAttribute': 'name',
        'autoImport': true,
        'libraryPath': '',
        'outputDirectory': 'src/generated'
      };
      return config[key] ?? defaultValue;
    }),
    update: jest.fn().mockResolvedValue(undefined)
  }),

  createFileSystemWatcher: jest.fn().mockReturnValue({
    onDidCreate: jest.fn(),
    onDidChange: jest.fn(),
    onDidDelete: jest.fn(),
    dispose: jest.fn()
  }),

  fs: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn()
  },

  openTextDocument: jest.fn().mockImplementation(() => Promise.resolve({
    getText: jest.fn().mockReturnValue(''),
    lineAt: jest.fn().mockReturnValue({ text: '' }),
    positionAt: jest.fn().mockReturnValue({ line: 0, character: 0 }),
    save: jest.fn().mockResolvedValue(true)
  })),
  
  applyEdit: jest.fn().mockResolvedValue(true),
  
  findFiles: jest.fn().mockResolvedValue([]),
  
  textDocuments: []
};

export const window = {
  showInformationMessage: jest.fn().mockResolvedValue(undefined),
  showWarningMessage: jest.fn().mockResolvedValue(undefined),
  showErrorMessage: jest.fn().mockResolvedValue(undefined),
  showQuickPick: jest.fn().mockResolvedValue(undefined),
  showInputBox: jest.fn().mockResolvedValue(undefined),
  showOpenDialog: jest.fn().mockResolvedValue(undefined),
  showSaveDialog: jest.fn().mockResolvedValue(undefined),
  
  createTreeView: jest.fn().mockReturnValue({
    onDidChangeSelection: jest.fn(),
    dispose: jest.fn()
  }),

  createWebviewPanel: jest.fn().mockReturnValue({
    webview: {
      html: '',
      postMessage: jest.fn().mockResolvedValue(true),
      onDidReceiveMessage: jest.fn(),
      asWebviewUri: jest.fn((uri: any) => uri)
    },
    reveal: jest.fn(),
    dispose: jest.fn(),
    onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    visible: true,
    viewColumn: 1
  }),

  registerTreeDataProvider: jest.fn(),
  registerWebviewViewProvider: jest.fn(),

  activeTextEditor: undefined as any,
  showTextDocument: jest.fn().mockResolvedValue({
    selection: null,
    revealRange: jest.fn()
  }),

  withProgress: jest.fn().mockImplementation(async (options, task) => {
    return await task({ report: jest.fn() });
  })
};

export const commands = {
  registerCommand: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  executeCommand: jest.fn().mockResolvedValue(undefined)
};

export const languages = {
  registerCompletionItemProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  registerHoverProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  registerCodeActionsProvider: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  createDiagnosticCollection: jest.fn().mockReturnValue({
    set: jest.fn(),
    delete: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn()
  })
};

export const env = {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
    readText: jest.fn().mockResolvedValue('')
  },
  openExternal: jest.fn().mockResolvedValue(true),
  language: 'en'
};

export class Uri {
  static file(path: string) {
    return { fsPath: path, scheme: 'file', path };
  }
  
  static parse(uri: string) {
    return { fsPath: uri, scheme: 'file', path: uri };
  }

  static joinPath(uri: any, ...pathSegments: string[]) {
    const basePath = uri.fsPath || uri.path || '';
    const joined = [basePath, ...pathSegments].join('/');
    return { fsPath: joined, scheme: 'file', path: joined };
  }
}

export class Position {
  constructor(public line: number, public character: number) {}
}

export class Range {
  public start: Position;
  public end: Position;

  constructor(startLine: number | Position, startChar: number | Position, endLine?: number, endChar?: number) {
    // Soporta ambas firmas: Range(Position, Position) y Range(number, number, number, number)
    if (typeof startLine === 'number' && typeof startChar === 'number') {
      this.start = new Position(startLine, startChar);
      this.end = new Position(endLine!, endChar!);
    } else {
      this.start = startLine as Position;
      this.end = startChar as Position;
    }
  }
  
  static create(startLine: number, startChar: number, endLine: number, endChar: number) {
    return new Range(startLine, startChar, endLine, endChar);
  }
}

export class Selection extends Range {
  constructor(
    public anchor: Position,
    public active: Position
  ) {
    super(anchor, active);
  }

  get isEmpty() {
    return this.anchor.line === this.active.line && 
           this.anchor.character === this.active.character;
  }
}

export class CompletionItem {
  constructor(
    public label: string,
    public kind?: CompletionItemKind
  ) {}
  
  detail?: string;
  documentation?: MarkdownString | string;
  sortText?: string;
  insertText?: string;
}

export enum ViewColumn {
  Active = -1,
  Beside = -2,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9
}

export enum CompletionItemKind {
  Text = 0,
  Method = 1,
  Function = 2,
  Constructor = 3,
  Field = 4,
  Variable = 5,
  Class = 6,
  Interface = 7,
  Module = 8,
  Property = 9,
  Unit = 10,
  Value = 11,
  Enum = 12,
  Keyword = 13,
  Snippet = 14,
  Color = 15,
  File = 16,
  Reference = 17,
  Folder = 18,
  EnumMember = 19,
  Constant = 20,
  Struct = 21,
  Event = 22,
  Operator = 23,
  TypeParameter = 24
}

export class MarkdownString {
  constructor(public value: string = '') {}
  
  supportHtml = false;
  isTrusted = false;
  
  appendMarkdown(value: string) {
    this.value += value;
    return this;
  }
  
  appendText(value: string) {
    this.value += value;
    return this;
  }
}

export class Hover {
  constructor(
    public contents: MarkdownString | string | Array<MarkdownString | string>,
    public range?: Range
  ) {}
}

export class CodeAction {
  constructor(
    public title: string,
    public kind?: CodeActionKind
  ) {}
  
  command?: any;
  edit?: WorkspaceEdit;
  diagnostics?: any[];
  isPreferred?: boolean;
}

export class WorkspaceEdit {
  private edits: Map<string, any[]> = new Map();

  replace(uri: any, range: Range, newText: string): void {
    const key = uri.fsPath || uri.path || uri.toString();
    if (!this.edits.has(key)) {
      this.edits.set(key, []);
    }
    this.edits.get(key)!.push({ range, newText, type: 'replace' });
  }

  insert(uri: any, position: Position, newText: string): void {
    const key = uri.fsPath || uri.path || uri.toString();
    if (!this.edits.has(key)) {
      this.edits.set(key, []);
    }
    this.edits.get(key)!.push({ position, newText, type: 'insert' });
  }

  delete(uri: any, range: Range): void {
    const key = uri.fsPath || uri.path || uri.toString();
    if (!this.edits.has(key)) {
      this.edits.set(key, []);
    }
    this.edits.get(key)!.push({ range, type: 'delete' });
  }

  has(uri: any): boolean {
    return this.edits.has(uri.fsPath || uri.path || uri.toString());
  }

  entries(): [any, any[]][] {
    return Array.from(this.edits.entries()).map(([key, edits]) => [Uri.file(key), edits]);
  }
}

export class CodeActionKind {
  static readonly QuickFix = new CodeActionKind('quickfix');
  static readonly Refactor = new CodeActionKind('refactor');
  static readonly RefactorExtract = new CodeActionKind('refactor.extract');
  static readonly RefactorInline = new CodeActionKind('refactor.inline');
  static readonly RefactorRewrite = new CodeActionKind('refactor.rewrite');
  static readonly Source = new CodeActionKind('source');
  static readonly SourceOrganizeImports = new CodeActionKind('source.organizeImports');
  
  constructor(public value: string) {}
}

export class Diagnostic {
  constructor(
    public range: Range,
    public message: string,
    public severity?: DiagnosticSeverity
  ) {}
  
  source?: string;
  code?: string | number;
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3
}

export class TreeItem {
  constructor(
    public label: string,
    public collapsibleState?: TreeItemCollapsibleState
  ) {}
  
  contextValue?: string;
  iconPath?: any;
  description?: string;
  tooltip?: string;
  command?: any;
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2
}

export class ThemeIcon {
  static readonly File = new ThemeIcon('file');
  static readonly Folder = new ThemeIcon('folder');
  
  constructor(public id: string, public color?: ThemeColor) {}
}

export class ThemeColor {
  constructor(public id: string) {}
}

export class EventEmitter<T> {
  private listeners: Array<(e: T) => void> = [];
  
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => this.listeners = this.listeners.filter(l => l !== listener) };
  };
  
  fire(data: T) {
    this.listeners.forEach(l => l(data));
  }
  
  dispose() {
    this.listeners = [];
  }
}

export class SnippetString {
  constructor(public value: string = '') {}
  
  appendText(value: string) {
    this.value += value;
    return this;
  }
  
  appendPlaceholder(value: string | ((snippet: SnippetString) => void), number?: number) {
    if (typeof value === 'string') {
      this.value += `\${${number ?? 1}:${value}}`;
    }
    return this;
  }
}

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15
}

export enum TextEditorRevealType {
  Default = 0,
  InCenter = 1,
  InCenterIfOutsideViewport = 2,
  AtTop = 3
}

// Mock para ExtensionContext
export const createMockExtensionContext = () => ({
  subscriptions: [],
  extensionUri: Uri.file('/test/extension'),
  extensionPath: '/test/extension',
  globalState: {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn().mockReturnValue([])
  },
  workspaceState: {
    get: jest.fn(),
    update: jest.fn(),
    keys: jest.fn().mockReturnValue([])
  },
  secrets: {
    get: jest.fn(),
    store: jest.fn(),
    delete: jest.fn()
  },
  storageUri: Uri.file('/test/storage'),
  globalStorageUri: Uri.file('/test/global-storage'),
  logUri: Uri.file('/test/logs')
});

// Helper para resetear todos los mocks
export const resetAllMocks = () => {
  jest.clearAllMocks();
};

// Exportación por defecto del módulo vscode mockeado
export default {
  workspace,
  window,
  commands,
  languages,
  env,
  Uri,
  Position,
  Range,
  Selection,
  ViewColumn,
  CompletionItem,
  CompletionItemKind,
  MarkdownString,
  Hover,
  CodeAction,
  CodeActionKind,
  WorkspaceEdit,
  Diagnostic,
  DiagnosticSeverity,
  TreeItem,
  TreeItemCollapsibleState,
  EventEmitter,
  SnippetString,
  ConfigurationTarget,
  ProgressLocation,
  TextEditorRevealType
};
