import * as path from 'path';
import { Script, createContext } from 'vm';

const fsStore: Record<string, string> = {};

const fsMock = {
  existsSync: jest.fn((p: string) => !!fsStore[require('path').normalize(p)]),
  mkdirSync: jest.fn((p: string) => { /* no-op */ }),
  writeFileSync: jest.fn((p: string, data: string) => { fsStore[require('path').normalize(p)] = data; }),
  readFileSync: jest.fn((p: string) => fsStore[require('path').normalize(p)] || ''),
};

jest.mock('fs', () => fsMock);
jest.mock('node:fs', () => fsMock);

// Mock svg config getters for spriteFilename / spritePrefix
jest.mock('../../utils/config', () => ({
  getSvgConfig: (key: string, def: any) => {
    if (key === 'spriteFilename') return 'sprite.custom.svg';
    if (key === 'spritePrefix') return 'iconx';
    return def;
  },
}));

import { addToSpriteSvg } from '../../utils/iconsFileManager';

// Helper: load generateSampleCode from the webview template
function loadGenerateSampleCode() {
  const tplPath = path.resolve(__dirname, '../../templates/icon-manager/IconStudio.js');
  const realFs = jest.requireActual('fs');
  const content = realFs.readFileSync(tplPath, 'utf8');
  const start = content.indexOf('function generateSampleCode(');
  const endMarker = '\n\nfunction renderContent(';
  const end = content.indexOf(endMarker, start);
  const funcText = content.substring(start, end);
  const ctx: any = {};
  createContext(ctx);
  const script = new Script(funcText);
  script.runInContext(ctx);
  return ctx.generateSampleCode as (format: string, cfg: Record<string, any>) => { language: string; code: string };
}

describe('Parity: Sprite preview vs generated sprite file', () => {
  beforeEach(() => {
    for (const k of Object.keys(fsStore)) delete fsStore[k];
  });

  test('should create sprite symbol with prefixed id and expected filename', async () => {
    const generateSampleCode = loadGenerateSampleCode();
    const cfg = { spritePrefix: 'iconx', spriteFilename: 'sprite.custom.svg' };
    const sample = generateSampleCode('sprite.svg', cfg);

    const transformer = {
      extractSvgBody: (s: string) => s.replace(/<svg[^>]*>|<\/svg>/g, ''),
      extractSvgAttributes: (s: string) => {
        const m = s.match(/viewBox="([^"]+)"/);
        return { viewBox: m ? m[1] : '0 0 24 24' };
      },
    } as any;

    await addToSpriteSvg('/output', 'home', '<svg viewBox="0 0 24 24"><path/></svg>', transformer);

    const expectedPath = '/output/sprite.custom.svg';
    const written = (require('fs').readFileSync(expectedPath) as string) || '';

    // (parity) sample vs written comparison

    // Expect sprite file to contain symbol id with prefix
    expect(written.includes(`id="${cfg.spritePrefix}-home"`)).toBe(true);
    // Expect the sample snippet to reference the same id and filename
    expect(sample.code.includes(`${cfg.spritePrefix}-home`)).toBe(true);
    expect(sample.code.includes(cfg.spriteFilename)).toBe(true);
  });
});
