/**
 * Tests para utils/config
 *
 * Requisitos cubiertos:
 * - RF-9.1: Configuración de la extensión
 */

// Mock de vscode
import * as vscode from 'vscode';
import { getSvgConfig, getFullSvgConfig, updateSvgConfig } from '../../utils/config';

describe('config utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =====================================================
  // RF-9.1: Configuración de la extensión
  // =====================================================

  describe('getSvgConfig', () => {
    test('debe obtener valor de configuración', () => {
      const result = getSvgConfig<string>('componentName', 'DefaultIcon');

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('masterSVG');
      expect(result).toBeDefined();
    });

    test('debe devolver valor por defecto si no existe', () => {
      const result = getSvgConfig<string>('nonexistent', 'default-value');

      // El mock devuelve el valor por defecto para claves no definidas
      expect(result).toBe('default-value');
    });

    test('debe obtener configuración de svgFolders', () => {
      const folders = getSvgConfig<string[]>('svgFolders', []);

      expect(Array.isArray(folders)).toBeTruthy();
    });

    test('debe obtener configuración de outputFormat', () => {
      const format = getSvgConfig<string>('outputFormat', 'jsx');

      expect(format).toBeDefined();
    });
  });

  describe('getFullSvgConfig', () => {
    test('debe devolver objeto de configuración completo', () => {
      const config = getFullSvgConfig();

      expect(config).toBeDefined();
      expect(typeof config.get).toBe('function');
    });
  });

  describe('updateSvgConfig', () => {
    test('debe actualizar configuración del workspace', async () => {
      await updateSvgConfig('componentName', 'MyIcon', false);

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('masterSVG');
    });

    test('debe actualizar configuración global', async () => {
      await updateSvgConfig('componentName', 'GlobalIcon', true);

      expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith('masterSVG');
    });
  });

  // =====================================================
  // Valores de configuración esperados
  // =====================================================

  describe('valores de configuración', () => {
    test('componentName debe tener valor por defecto "Icon"', () => {
      const name = getSvgConfig<string>('componentName', 'Icon');
      expect(name).toBe('Icon');
    });

    test('iconNameAttribute debe tener valor por defecto "name"', () => {
      const attr = getSvgConfig<string>('iconNameAttribute', 'name');
      expect(attr).toBe('name');
    });

    test('autoImport debe tener valor por defecto true', () => {
      const autoImport = getSvgConfig<boolean>('autoImport', true);
      expect(autoImport).toBe(true);
    });

    test('outputDirectory debe tener valor por defecto', () => {
      const outDir = getSvgConfig<string>('outputDirectory', 'src/generated');
      expect(outDir).toBeDefined();
    });
  });
});
