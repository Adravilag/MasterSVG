/**
 * Mock del ConfigService para tests
 */

export const mockConfig = {
  source: { directories: ['src/assets/svg'], ignore: [] },
  output: { format: 'icons.js', structure: 'flat', directory: 'src/icons' },
  framework: { type: 'react', typescript: true, component: { name: 'Icon', webComponentTag: 'svg-icon' } },
  optimization: { svgo: { enabled: true } },
  icons: { defaultSize: 48, naming: 'kebab-case' },
  editor: { scanOnStartup: true, previewBackground: 'checkered', autoImport: true },
  animations: { presets: {} },
  licenses: { autoGenerate: false },
};

export const mockConfigService = {
  getConfig: jest.fn().mockReturnValue(mockConfig),
  getSection: jest.fn().mockImplementation((section: string) => (mockConfig as Record<string, unknown>)[section]),
  hasConfigFile: jest.fn().mockReturnValue(true),
  getConfigPath: jest.fn().mockReturnValue('/test/mastersvg.config.json'),
  loadConfig: jest.fn().mockReturnValue(mockConfig),
  createConfigFile: jest.fn().mockResolvedValue('/test/mastersvg.config.json'),
  updateConfig: jest.fn().mockResolvedValue(true),
  onConfigChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
  dispose: jest.fn(),
  getOutputPaths: jest.fn().mockReturnValue({
    components: '/test/src/icons',
    assets: '/test/src/icons',
    types: '/test/src/icons',
  }),
  getComponentFileName: jest.fn().mockReturnValue('Icon.tsx'),
  getDataFileName: jest.fn().mockReturnValue('svg-data.ts'),
  useTypeScript: jest.fn().mockReturnValue(true),
};

export const ConfigService = {
  getInstance: jest.fn().mockReturnValue(mockConfigService),
  resetInstance: jest.fn(),
};
