import * as fs from 'fs';
import * as path from 'path';
import { Script, createContext } from 'vm';

import { getComponentExporter } from '../../services/framework/ComponentExporter';

// Helper: load generateSampleCode from the webview template
function loadGenerateSampleCode() {
  const tplPath = path.resolve(__dirname, '../../templates/icon-manager/IconStudio.js');
  const content = fs.readFileSync(tplPath, 'utf8');
  const start = content.indexOf('function generateSampleCode(');
  if (start === -1) throw new Error('generateSampleCode not found in template');
  const endMarker = '\n\nfunction renderContent(';
  const end = content.indexOf(endMarker, start);
  if (end === -1) throw new Error('renderContent marker not found');
  const funcText = content.substring(start, end);

  const ctx: any = {};
  createContext(ctx);
  // Evaluate the function in the VM context; the function will be defined in ctx
  const script = new Script(funcText);
  script.runInContext(ctx);
  return ctx.generateSampleCode as (format: string, cfg: Record<string, any>) => { language: string; code: string };
}

describe('Parity: webview sample vs ComponentExporter (React)', () => {
  test('React TSX with forwardRef should match sample code', () => {
    const generateSampleCode = loadGenerateSampleCode();

    const cfg = {
      exportType: 'named',
      naming: 'IconHome',
      typescript: true,
      forwardRef: true,
    } as const;

    const sample = generateSampleCode('icons.js', cfg);

    const exporter = getComponentExporter();

    const svg = '<svg width="24" height="24" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';

    const result = exporter.export({
      format: 'react',
      iconName: 'home',
      svg,
      typescript: true,
      forwardRef: true,
      exportType: 'named',
      componentName: 'IconHome',
    } as any);

    expect(result).toBeDefined();
    // Strict comparison of trimmed codes to detect any mismatch (WYSIWYG contract)
    expect(result.code.trim()).toBe(sample.code.trim());
  });
});
