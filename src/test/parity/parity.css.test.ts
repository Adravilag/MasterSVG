import * as path from 'path';
import { Script, createContext } from 'vm';

// In-memory fs store for captures
const fsStore: Record<string, string> = {};

const fsMock = {
  existsSync: jest.fn((p: string) => !!fsStore[require('path').normalize(p)]),
  mkdirSync: jest.fn((p: string) => { /* no-op */ }),
  writeFileSync: jest.fn((p: string, data: string) => { fsStore[require('path').normalize(p)] = data; }),
  readFileSync: jest.fn((p: string) => fsStore[require('path').normalize(p)] || ''),
};

jest.mock('fs', () => fsMock);
jest.mock('node:fs', () => fsMock);

// Mock config helpers used by buildIcon
jest.mock('../../utils/configHelper', () => ({
  getConfig: jest.fn().mockReturnValue({ buildFormat: 'css', outputDirectory: 'icons' }),
  getOutputPathOrWarn: jest.fn().mockReturnValue('/workspace/icons'),
  getFullOutputPath: jest.fn().mockReturnValue('/workspace/icons'),
}));

// Mock iconsFileManager helpers not used directly here
jest.mock('../../utils/iconsFileManager', () => ({
  addToIconsJs: jest.fn().mockResolvedValue(undefined),
  addToSpriteSvg: jest.fn().mockResolvedValue(undefined),
}));

// Mock svg config getters for classPrefix / cssMethod
jest.mock('../../utils/config', () => ({
  getSvgConfig: (key: string, def: any) => {
    if (key === 'classPrefix') return 'i-';
    if (key === 'cssMethod') return 'mask';
    return def;
  },
}));

import { buildIcon } from '../../utils/iconBuildHelpers';

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

describe('Parity: CSS preview vs generated CSS', () => {
  beforeEach(() => {
    for (const k of Object.keys(fsStore)) delete fsStore[k];
  });

  test('should generate class rule matching preview (mask method, i- prefix)', async () => {
    const generateSampleCode = loadGenerateSampleCode();
    const cfg = { cssMethod: 'mask', classPrefix: 'i-' };
    const sample = generateSampleCode('css', cfg);

    // Run buildIcon which writes files to the mocked fs
    const res = await buildIcon({ iconName: 'home', svgContent: '<svg><path/></svg>', svgTransformer: {} as any });
    expect(res.success).toBe(true);

    const cssPath = '/workspace/icons/icons.css';
    const written = (require('fs').readFileSync(cssPath) as string) || '';

    // (parity) sample vs written comparison

    // Expect the exact rule block from sample to appear in written css (strict parity)
    expect(written.includes(sample.code.trim())).toBe(true);
  });
});
