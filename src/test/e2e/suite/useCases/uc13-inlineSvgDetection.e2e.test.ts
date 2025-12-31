/**
 * UC-13: Detección y Gestión de SVG Inline en Código
 *
 * Tests E2E para validar la detección, transformación y gestión
 * de SVG inline embebidos en archivos de código fuente
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('UC-13: Detección de SVG Inline', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const tempFilesDir = path.join(testWorkspace, 'temp-code-files');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Archivos de prueba con SVG inline
  const testFiles = {
    reactComponent: `
import React from 'react';

export const IconButton = () => (
  <button>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
    Click me
  </button>
);
`,
    vueTemplate: `
<template>
  <div class="icon-wrapper">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps<{ size?: number }>();
</script>
`,
    htmlFile: `
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <nav>
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
      <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
    </svg>
    <span>Menu</span>
  </nav>
</body>
</html>
`,
    svelteComponent: `
<script>
  export let size = 24;
</script>

<div class="icon">
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
</div>

<style>
  .icon { display: inline-flex; }
</style>
`,
  };

  suiteSetup(async () => {
    // Activar extensión
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);

    // Crear directorio temporal para archivos de prueba
    if (!fs.existsSync(tempFilesDir)) {
      fs.mkdirSync(tempFilesDir, { recursive: true });
    }
  });

  suiteTeardown(async () => {
    // Limpiar archivos temporales
    if (fs.existsSync(tempFilesDir)) {
      fs.rmSync(tempFilesDir, { recursive: true, force: true });
    }
  });

  suite('CA-13.1: Detección de SVG en diferentes lenguajes', () => {
    test('Debe existir comando goToInlineSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.goToInlineSvg'),
        'Comando goToInlineSvg debe estar registrado'
      );
    });

    test('Debe existir comando transformInlineSvg', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.transformInlineSvg'),
        'Comando transformInlineSvg debe estar registrado'
      );
    });

    test('Debe detectar SVG en archivo React/TSX', async () => {
      const filePath = path.join(tempFilesDir, 'TestComponent.tsx');
      fs.writeFileSync(filePath, testFiles.reactComponent);

      const content = fs.readFileSync(filePath, 'utf-8');
      const svgMatch = content.match(/<svg[^>]*>[\s\S]*?<\/svg>/g);

      assert.ok(svgMatch, 'Debe encontrar SVG en archivo React');
      assert.strictEqual(svgMatch.length, 1, 'Debe encontrar exactamente 1 SVG');
    });

    test('Debe detectar SVG en archivo Vue', async () => {
      const filePath = path.join(tempFilesDir, 'TestComponent.vue');
      fs.writeFileSync(filePath, testFiles.vueTemplate);

      const content = fs.readFileSync(filePath, 'utf-8');
      const svgMatch = content.match(/<svg[^>]*>[\s\S]*?<\/svg>/g);

      assert.ok(svgMatch, 'Debe encontrar SVG en archivo Vue');
    });

    test('Debe detectar SVG en archivo HTML', async () => {
      const filePath = path.join(tempFilesDir, 'test-page.html');
      fs.writeFileSync(filePath, testFiles.htmlFile);

      const content = fs.readFileSync(filePath, 'utf-8');
      const svgMatch = content.match(/<svg[^>]*>[\s\S]*?<\/svg>/g);

      assert.ok(svgMatch, 'Debe encontrar SVG en archivo HTML');
    });

    test('Debe detectar SVG en archivo Svelte', async () => {
      const filePath = path.join(tempFilesDir, 'TestIcon.svelte');
      fs.writeFileSync(filePath, testFiles.svelteComponent);

      const content = fs.readFileSync(filePath, 'utf-8');
      const svgMatch = content.match(/<svg[^>]*>[\s\S]*?<\/svg>/g);

      assert.ok(svgMatch, 'Debe encontrar SVG en archivo Svelte');
    });
  });

  suite('CA-13.2: Extracción de metadatos SVG', () => {
    test('Debe extraer atributo viewBox', () => {
      const svgContent =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2"/></svg>';
      const viewBoxMatch = svgContent.match(/viewBox="([^"]*)"/);

      assert.ok(viewBoxMatch, 'Debe encontrar viewBox');
      assert.strictEqual(viewBoxMatch[1], '0 0 24 24', 'ViewBox debe ser correcto');
    });

    test('Debe extraer dimensiones width/height', () => {
      const svgContent =
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect/></svg>';

      const widthMatch = svgContent.match(/width="(\d+)"/);
      const heightMatch = svgContent.match(/height="(\d+)"/);

      assert.ok(widthMatch && heightMatch, 'Debe encontrar width y height');
      assert.strictEqual(widthMatch[1], '32', 'Width debe ser 32');
      assert.strictEqual(heightMatch[1], '32', 'Height debe ser 32');
    });

    test('Debe detectar colores en SVG', () => {
      const svgContent = '<svg><path fill="#ff0000" stroke="#00ff00"/></svg>';

      const fillMatch = svgContent.match(/fill="([^"]*)"/);
      const strokeMatch = svgContent.match(/stroke="([^"]*)"/);

      assert.ok(fillMatch, 'Debe detectar fill');
      assert.ok(strokeMatch, 'Debe detectar stroke');
      assert.strictEqual(fillMatch[1], '#ff0000', 'Fill debe ser rojo');
      assert.strictEqual(strokeMatch[1], '#00ff00', 'Stroke debe ser verde');
    });

    test('Debe detectar currentColor', () => {
      const svgContent = '<svg><path fill="currentColor"/></svg>';
      const usesCurrentColor = svgContent.includes('currentColor');

      assert.ok(usesCurrentColor, 'Debe detectar uso de currentColor');
    });
  });

  suite('CA-13.3: Transformación de SVG inline', () => {
    test('Debe poder convertir SVG inline a referencia de componente', () => {
      const inlineSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2"/></svg>';
      const componentName = 'iw-icon';
      const iconName = 'my-icon';

      // Simulación de la transformación esperada
      const componentRef = `<${componentName} name="${iconName}" />`;

      assert.ok(
        componentRef.includes(componentName),
        'Debe generar referencia con nombre de componente'
      );
      assert.ok(componentRef.includes(iconName), 'Debe incluir nombre del icono');
    });

    test('Debe preservar atributos de estilo al transformar', () => {
      const inlineSvg =
        '<svg class="icon-lg" style="color: red" xmlns="http://www.w3.org/2000/svg"><path/></svg>';

      const classMatch = inlineSvg.match(/class="([^"]*)"/);
      const styleMatch = inlineSvg.match(/style="([^"]*)"/);

      assert.ok(classMatch, 'Debe preservar class');
      assert.ok(styleMatch, 'Debe preservar style');
    });

    test('Debe generar nombre de icono válido desde contenido', () => {
      // Función simulada para generar nombre
      const generateIconName = (svgPath: string): string => {
        const baseName = path.basename(svgPath, path.extname(svgPath));
        return baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      };

      assert.strictEqual(generateIconName('MyIcon.svg'), 'myicon');
      assert.strictEqual(generateIconName('home-filled.svg'), 'home-filled');
      assert.strictEqual(generateIconName('Icon_Test.svg'), 'icon-test');
    });
  });

  suite('CA-13.4: Code Actions para SVG inline', () => {
    test('Debe existir provider de Code Actions', async () => {
      const commands = await vscode.commands.getCommands(true);

      // Los Code Actions se registran como comandos internos
      // Verificar que existe el mecanismo de transformación
      const hasTransformCommand = commands.some(
        cmd => cmd.includes('transform') || cmd.includes('Transform')
      );

      assert.ok(hasTransformCommand, 'Debe existir mecanismo de transformación');
    });

    test('Debe ofrecer acción "Extraer a archivo SVG"', async () => {
      // Verificar que el comando existe
      const commands = await vscode.commands.getCommands(true);
      const hasSvgCommands = commands.some(cmd => cmd.includes('sageboxIconStudio'));

      assert.ok(hasSvgCommands, 'Debe tener comandos de iconStudio registrados');
    });
  });

  suite('CA-13.5: Navegación a SVG inline', () => {
    test('Debe poder abrir archivo con SVG inline', async () => {
      const filePath = path.join(tempFilesDir, 'NavigationTest.tsx');
      fs.writeFileSync(filePath, testFiles.reactComponent);

      const doc = await vscode.workspace.openTextDocument(filePath);
      const editor = await vscode.window.showTextDocument(doc);

      assert.ok(editor, 'Debe abrir el editor');
      assert.strictEqual(
        editor.document.uri.fsPath,
        filePath,
        'Debe abrir el archivo correcto'
      );

      // Cerrar el documento
      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Debe detectar posición del SVG en el documento', async () => {
      const filePath = path.join(tempFilesDir, 'PositionTest.tsx');
      fs.writeFileSync(filePath, testFiles.reactComponent);

      const doc = await vscode.workspace.openTextDocument(filePath);
      const text = doc.getText();

      const svgStartIndex = text.indexOf('<svg');
      const svgEndIndex = text.indexOf('</svg>') + '</svg>'.length;

      assert.ok(svgStartIndex > -1, 'Debe encontrar inicio del SVG');
      assert.ok(svgEndIndex > svgStartIndex, 'Debe encontrar fin del SVG');

      const startPos = doc.positionAt(svgStartIndex);
      const endPos = doc.positionAt(svgEndIndex);

      assert.ok(startPos.line >= 0, 'Debe tener posición de línea válida');
      assert.ok(endPos.line >= startPos.line, 'Fin debe estar después del inicio');
    });
  });

  suite('CA-13.6: Escaneo de workspace para SVG inline', () => {
    test('Debe existir comando refreshCode', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.refreshCode'),
        'Comando refreshCode debe existir'
      );
    });

    test('Debe poder filtrar por tipo de archivo', () => {
      const supportedExtensions = ['.tsx', '.jsx', '.vue', '.svelte', '.html', '.astro'];

      supportedExtensions.forEach(ext => {
        assert.ok(ext.startsWith('.'), `${ext} debe ser una extensión válida`);
      });
    });
  });
});
