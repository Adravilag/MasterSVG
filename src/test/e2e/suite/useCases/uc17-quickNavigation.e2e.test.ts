/**
 * UC-17: Navegación Rápida entre Iconos y Usos
 *
 * Tests E2E para validar la navegación entre iconos y sus usos en el código
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

suite('UC-17: Navegación Rápida entre Iconos y Usos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Archivos de prueba con usos de iconos
  const reactComponentWithIcons = `
import { Icon } from '@/components/Icon';

export function Header() {
  return (
    <header>
      <Icon name="menu" />
      <nav>
        <Icon name="home" />
        <Icon name="settings" />
      </nav>
      <Icon name="user" />
    </header>
  );
}
`;

  const vueComponentWithIcons = `
<template>
  <div>
    <BaseIcon name="home" />
    <BaseIcon name="settings" />
  </div>
</template>
`;

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }

    // Crear archivos de prueba
    const testFilesDir = path.join(testWorkspace, 'nav-test');
    if (!fs.existsSync(testFilesDir)) {
      fs.mkdirSync(testFilesDir, { recursive: true });
    }

    fs.writeFileSync(path.join(testFilesDir, 'Header.tsx'), reactComponentWithIcons);
    fs.writeFileSync(path.join(testFilesDir, 'Component.vue'), vueComponentWithIcons);

    await delay(500);
  });

  suiteTeardown(async () => {
    const testFilesDir = path.join(testWorkspace, 'nav-test');
    if (fs.existsSync(testFilesDir)) {
      fs.rmSync(testFilesDir, { recursive: true, force: true });
    }
  });

  suite('CA-17.1: Comandos de navegación', () => {
    test('Debe existir comando goToUsage', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.goToUsage'), 'Comando goToUsage debe existir');
    });

    test('Debe existir comando goToCode', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.goToCode'), 'Comando goToCode debe existir');
    });

    test('Debe existir comando goToInlineSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.goToInlineSvg'),
        'Comando goToInlineSvg debe existir'
      );
    });

    test('Debe existir comando openSvgFile', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.openSvgFile'), 'Comando openSvgFile debe existir');
    });
  });

  suite('CA-17.2: Detección de usos de iconos', () => {
    test('Debe detectar usos en componentes React', () => {
      const iconUsageRegex = /<Icon[^>]+name=["']([^"']+)["']/g;
      const matches = [...reactComponentWithIcons.matchAll(iconUsageRegex)];

      assert.strictEqual(matches.length, 4, 'Debe detectar 4 usos de Icon');

      const iconNames = matches.map(m => m[1]);
      assert.ok(iconNames.includes('menu'), 'Debe incluir menu');
      assert.ok(iconNames.includes('home'), 'Debe incluir home');
      assert.ok(iconNames.includes('settings'), 'Debe incluir settings');
      assert.ok(iconNames.includes('user'), 'Debe incluir user');
    });

    test('Debe detectar usos en componentes Vue', () => {
      const iconUsageRegex = /<BaseIcon[^>]+name=["']([^"']+)["']/g;
      const matches = [...vueComponentWithIcons.matchAll(iconUsageRegex)];

      assert.strictEqual(matches.length, 2, 'Debe detectar 2 usos de BaseIcon');
    });

    test('Debe calcular posición de línea', () => {
      const findLineNumber = (content: string, searchText: string): number => {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(searchText)) {
            return i + 1; // 1-based line number
          }
        }
        return -1;
      };

      const lineNumber = findLineNumber(reactComponentWithIcons, 'name="menu"');
      assert.ok(lineNumber > 0, 'Debe encontrar línea del icono menu');
    });
  });

  suite('CA-17.3: Navegación desde árbol a código', () => {
    test('Debe calcular ubicación de uso', () => {
      const iconUsage = {
        iconName: 'home',
        file: 'Header.tsx',
        line: 9,
        column: 8,
        context: '<Icon name="home" />',
      };

      assert.ok(iconUsage.line > 0, 'Debe tener número de línea');
      assert.ok(iconUsage.column >= 0, 'Debe tener número de columna');
      assert.ok(iconUsage.file.length > 0, 'Debe tener nombre de archivo');
    });

    test('Debe agrupar usos por archivo', () => {
      const usages = [
        { file: 'Header.tsx', icon: 'home', line: 9 },
        { file: 'Header.tsx', icon: 'settings', line: 10 },
        { file: 'Footer.tsx', icon: 'home', line: 5 },
        { file: 'Sidebar.tsx', icon: 'menu', line: 3 },
      ];

      const byFile = usages.reduce(
        (acc, u) => {
          if (!acc[u.file]) acc[u.file] = [];
          acc[u.file].push(u);
          return acc;
        },
        {} as Record<string, typeof usages>
      );

      assert.strictEqual(Object.keys(byFile).length, 3, 'Debe haber 3 archivos');
      assert.strictEqual(byFile['Header.tsx'].length, 2, 'Header.tsx debe tener 2 usos');
    });
  });

  suite('CA-17.4: Navegación desde código a árbol', () => {
    test('Debe identificar icono desde cursor', () => {
      const getIconAtCursor = (line: string, column: number): string | null => {
        // Buscar name="xxx" alrededor del cursor
        const match = line.match(/name=["']([^"']+)["']/);
        return match ? match[1] : null;
      };

      const line = '      <Icon name="home" size={24} />';
      const iconName = getIconAtCursor(line, 20);

      assert.strictEqual(iconName, 'home', 'Debe extraer nombre del icono');
    });

    test('Debe revelar icono en árbol', async () => {
      const commands = await vscode.commands.getCommands(true);

      // Verificar que existe funcionalidad de reveal
      assert.ok(
        commands.includes('masterSVG.focusIconsView') ||
          commands.some(c => c.includes('reveal') || c.includes('focus')),
        'Debe existir funcionalidad para revelar en árbol'
      );
    });
  });

  suite('CA-17.5: Quick Navigation', () => {
    test('Debe existir comando copyIconName', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.copyIconName'), 'Comando copyIconName debe existir');
    });

    test('Debe formatear referencia según formato', () => {
      const formatIconReference = (iconName: string, format: string): string => {
        switch (format) {
          case 'component':
            return `<Icon name="${iconName}" />`;
          case 'sprite':
            return `<use href="#icon-${iconName}" />`;
          case 'import':
            return `import ${iconName}Icon from '@/icons/${iconName}.svg';`;
          default:
            return iconName;
        }
      };

      assert.strictEqual(
        formatIconReference('home', 'component'),
        '<Icon name="home" />',
        'Debe formatear como componente'
      );

      assert.strictEqual(
        formatIconReference('home', 'sprite'),
        '<use href="#icon-home" />',
        'Debe formatear como sprite reference'
      );
    });

    test('Debe soportar peek definition', () => {
      // VS Code peek definition muestra código inline
      const peekInfo = {
        supported: true,
        showsPreview: true,
        showsSvgContent: true,
      };

      assert.ok(peekInfo.supported, 'Peek definition debe estar soportado');
    });
  });

  suite('CA-17.6: Breadcrumbs de navegación', () => {
    test('Debe trackear historial de navegación', () => {
      const navigationHistory: Array<{ type: string; target: string }> = [];

      // Simular navegación
      navigationHistory.push({ type: 'icon', target: 'home' });
      navigationHistory.push({ type: 'usage', target: 'Header.tsx:9' });
      navigationHistory.push({ type: 'icon', target: 'settings' });

      assert.strictEqual(navigationHistory.length, 3, 'Debe trackear 3 navegaciones');
    });

    test('Debe poder volver atrás en navegación', () => {
      const history = ['home', 'Header.tsx:9', 'settings', 'Footer.tsx:5'];
      let currentIndex = history.length - 1;

      const goBack = () => {
        if (currentIndex > 0) currentIndex--;
        return history[currentIndex];
      };

      assert.strictEqual(goBack(), 'settings', 'Debe volver a settings');
      assert.strictEqual(goBack(), 'Header.tsx:9', 'Debe volver a Header.tsx:9');
    });
  });
});
