/**
 * Tests para ComponentExporter
 * 
 * Requisitos cubiertos:
 * - RF-2.3: Exportar como Componente Individual
 */

// Mock de vscode antes de importar el módulo
import { ComponentExporter, ComponentFormat, ExportOptions } from '../../services/ComponentExporter';

describe('ComponentExporter', () => {
  let exporter: ComponentExporter;
  
  const testSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor"/>
  </svg>`;

  const baseOptions: ExportOptions = {
    format: 'react',
    typescript: true,
    iconName: 'arrow-right',
    svg: testSvg,
    defaultSize: 24,
    defaultColor: 'currentColor'
  };

  beforeEach(() => {
    exporter = new ComponentExporter();
  });

  // =====================================================
  // RF-2.3: Exportar como Componente Individual
  // =====================================================

  describe('getFormats', () => {
    test('debe retornar todos los formatos soportados', () => {
      const formats = exporter.getFormats();

      expect(formats.length).toBeGreaterThan(0);
      expect(formats.map(f => f.id)).toContain('react');
      expect(formats.map(f => f.id)).toContain('react-native');
      expect(formats.map(f => f.id)).toContain('vue');
      expect(formats.map(f => f.id)).toContain('svelte');
      expect(formats.map(f => f.id)).toContain('angular');
      expect(formats.map(f => f.id)).toContain('solid');
      expect(formats.map(f => f.id)).toContain('qwik');
    });

    test('cada formato debe tener id, name y description', () => {
      const formats = exporter.getFormats();

      formats.forEach(format => {
        expect(format.id).toBeDefined();
        expect(format.name).toBeDefined();
        expect(format.description).toBeDefined();
      });
    });
  });

  // CA-2.3.1: Soporta React (.tsx/.jsx)
  describe('CA-2.3.1: export React', () => {
    test('debe generar componente React con TypeScript', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        typescript: true
      });

      expect(result.filename).toMatch(/\.tsx$/);
      expect(result.language).toBe('typescriptreact');
      expect(result.code).toContain('import React');
      expect(result.code).toContain('interface');
      // La implementación usa una arrow function con props tipados, no React.FC
      expect(result.code).toContain('Props');
    });

    test('debe generar componente React con JavaScript', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        typescript: false
      });

      expect(result.filename).toMatch(/\.jsx$/);
      expect(result.language).toBe('javascriptreact');
      expect(result.code).not.toContain('interface');
    });

    test('debe incluir props size y color', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react'
      });

      expect(result.code).toContain('size');
      expect(result.code).toContain('color');
    });

    test('debe usar PascalCase para el nombre del componente', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        iconName: 'arrow-right'
      });

      expect(result.code).toContain('ArrowRight');
    });
  });

  // CA-2.3.2: Soporta React Native
  describe('CA-2.3.2: export React Native', () => {
    test('debe generar componente React Native', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react-native',
        typescript: true
      });

      expect(result.code).toContain('react-native-svg');
      expect(result.code).toContain('Svg');
    });

    test('debe importar componentes de react-native-svg', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react-native'
      });

      expect(result.code).toMatch(/import.*from\s+['"]react-native-svg['"]/);
    });
  });

  // CA-2.3.3: Soporta Vue (.vue)
  describe('CA-2.3.3: export Vue', () => {
    test('debe generar Vue Composition API', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'vue',
        typescript: true
      });

      expect(result.filename).toMatch(/\.vue$/);
      expect(result.code).toContain('<script');
      expect(result.code).toContain('<template>');
    });

    test('debe generar Vue SFC', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'vue-sfc'
      });

      expect(result.filename).toMatch(/\.vue$/);
      expect(result.code).toContain('<template>');
    });
  });

  // CA-2.3.4: Soporta Svelte (.svelte)
  describe('CA-2.3.4: export Svelte', () => {
    test('debe generar componente Svelte', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'svelte'
      });

      expect(result.filename).toMatch(/\.svelte$/);
      expect(result.language).toBe('svelte');
      expect(result.code).toContain('<script');
      expect(result.code).toContain('export let');
    });

    test('debe incluir props exportadas', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'svelte'
      });

      expect(result.code).toContain('export let size');
      expect(result.code).toContain('export let color');
    });
  });

  // CA-2.3.5: Soporta Angular (.component.ts)
  describe('CA-2.3.5: export Angular', () => {
    test('debe generar componente Angular', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'angular',
        typescript: true
      });

      expect(result.filename).toMatch(/\.component\.ts$/);
      expect(result.code).toContain('@Component');
      expect(result.code).toContain('@Input');
    });

    test('debe usar selector kebab-case', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'angular',
        iconName: 'arrow-right'
      });

      // La implementación usa el nombre sin prefijo 'app-'
      expect(result.code).toContain("selector: 'arrow-right-icon'");
    });
  });

  // CA-2.3.6: Soporta SolidJS
  describe('CA-2.3.6: export SolidJS', () => {
    test('debe generar componente Solid', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'solid',
        typescript: true
      });

      expect(result.filename).toMatch(/\.tsx$/);
      expect(result.code).toContain('solid-js');
      expect(result.code).toContain('Component');
    });

    test('debe usar splitProps', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'solid'
      });

      expect(result.code).toContain('splitProps');
    });
  });

  // CA-2.3.7: Soporta Qwik
  describe('CA-2.3.7: export Qwik', () => {
    test('debe generar componente Qwik', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'qwik',
        typescript: true
      });

      expect(result.filename).toMatch(/\.tsx$/);
      expect(result.code).toContain('@builder.io/qwik');
      expect(result.code).toContain('component$');
    });
  });

  // CA-2.3.8: Soporta Preact
  describe('CA-2.3.8: export Preact', () => {
    test('debe generar componente Preact', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'preact',
        typescript: true
      });

      expect(result.filename).toMatch(/\.tsx$/);
      // Preact usa la misma API que React pero diferente import
      expect(result.code).toContain('React');
    });
  });

  // CA-2.3.9: Permite elegir TypeScript o JavaScript
  describe('CA-2.3.9: TypeScript vs JavaScript', () => {
    const formats: ComponentFormat[] = ['react', 'solid', 'qwik', 'preact'];

    formats.forEach(format => {
      test(`${format}: TypeScript debe tener extensión .tsx y types`, () => {
        const result = exporter.export({
          ...baseOptions,
          format,
          typescript: true
        });

        expect(result.filename).toMatch(/\.tsx$/);
        expect(result.code).toMatch(/interface|type\s+\w+Props/);
      });

      test(`${format}: JavaScript debe tener extensión .jsx sin types`, () => {
        const result = exporter.export({
          ...baseOptions,
          format,
          typescript: false
        });

        expect(result.filename).toMatch(/\.jsx$/);
        expect(result.code).not.toMatch(/interface\s+\w+Props/);
      });
    });
  });

  // =====================================================
  // Opciones adicionales
  // =====================================================

  describe('opciones de exportación', () => {
    test('debe soportar forwardRef en React', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        forwardRef: true
      });

      expect(result.code).toContain('forwardRef');
    });

    test('debe soportar memo en React', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        memo: true
      });

      expect(result.code).toContain('memo');
    });

    test('debe soportar export default', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        exportType: 'default'
      });

      expect(result.code).toContain('export default');
    });

    test('debe soportar named export', () => {
      const result = exporter.export({
        ...baseOptions,
        format: 'react',
        exportType: 'named'
      });

      // La implementación usa: export  { ComponentName };
      expect(result.code).toMatch(/export\s+\{\s*\w+\s*\}/);
    });
  });

  // =====================================================
  // Conversión de nombres
  // =====================================================

  describe('conversión de nombres', () => {
    test('debe convertir kebab-case a PascalCase', () => {
      const result = exporter.export({
        ...baseOptions,
        iconName: 'arrow-up-right'
      });

      expect(result.code).toContain('ArrowUpRight');
    });

    test('debe convertir snake_case a PascalCase', () => {
      const result = exporter.export({
        ...baseOptions,
        iconName: 'arrow_up_right'
      });

      expect(result.code).toContain('ArrowUpRight');
    });

    test('debe manejar nombres con números', () => {
      const result = exporter.export({
        ...baseOptions,
        iconName: 'icon-24px'
      });

      expect(result.code).toContain('Icon24px');
    });
  });
});


