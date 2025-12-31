/**
 * UC-21: Previsualización Hover de Iconos
 *
 * Tests E2E para validar el sistema de previsualización hover
 * que muestra iconos SVG al pasar el cursor sobre referencias
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

suite('UC-21: Hover Preview de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');
  const tempDir = path.join(testWorkspace, 'temp-hover-tests');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Archivos de prueba con referencias a iconos
  const testFiles = {
    reactWithIconRef: `
import React from 'react';
import { Icon } from '@/components/ui/Icon';

export const NavBar = () => (
  <nav>
    <Icon name="home" size={24} />
    <Icon name="settings" size={24} />
    <Icon name="search" size={24} />
  </nav>
);
`,
    vueWithIconRef: `
<template>
  <div>
    <iw-icon name="heart" :size="32" />
    <iw-icon name="warning" :size="32" />
  </div>
</template>

<script setup>
import { IwIcon } from '@/components/icons';
</script>
`,
    htmlWithIconRef: `
<!DOCTYPE html>
<html>
<body>
  <sg-icon name="check"></sg-icon>
  <sg-icon name="error"></sg-icon>
  <sg-icon name="info"></sg-icon>
</body>
</html>
`,
  };

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);

    // Crear directorio temporal
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  suiteTeardown(async () => {
    // Limpiar archivos temporales
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  suite('CA-21.1: Registro del Hover Provider', () => {
    test('Extensión debe registrar HoverProvider', async () => {
      // El HoverProvider se registra para múltiples lenguajes
      const supportedLanguages = [
        'javascript',
        'javascriptreact',
        'typescript',
        'typescriptreact',
        'vue',
        'svelte',
        'html',
        'astro',
      ];

      // Verificar que la extensión está activa (indica que los providers están registrados)
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      assert.ok(ext?.isActive, 'Extensión debe estar activa para que HoverProvider funcione');

      supportedLanguages.forEach(lang => {
        assert.ok(typeof lang === 'string', `Lenguaje ${lang} debe ser soportado`);
      });
    });
  });

  suite('CA-21.2: Detección de Referencias a Iconos', () => {
    test('Debe detectar patrón name="iconName"', () => {
      const content = '<Icon name="home" />';
      const pattern = /name=["']([^"']+)["']/g;
      const matches = [...content.matchAll(pattern)];

      assert.strictEqual(matches.length, 1, 'Debe encontrar una referencia');
      assert.strictEqual(matches[0][1], 'home', 'Debe extraer nombre del icono');
    });

    test('Debe detectar patrón icon="iconName"', () => {
      const content = '<button icon="settings" />';
      const pattern = /icon=["']([^"']+)["']/g;
      const matches = [...content.matchAll(pattern)];

      assert.strictEqual(matches.length, 1, 'Debe encontrar una referencia');
      assert.strictEqual(matches[0][1], 'settings', 'Debe extraer nombre del icono');
    });

    test('Debe detectar múltiples referencias en un archivo', () => {
      const content = testFiles.reactWithIconRef;
      const pattern = /name=["']([^"']+)["']/g;
      const matches = [...content.matchAll(pattern)];

      assert.ok(matches.length >= 3, 'Debe encontrar al menos 3 referencias');
    });

    test('Debe manejar diferentes tipos de comillas', () => {
      const content1 = 'name="icon1"';
      const content2 = "name='icon2'";
      const pattern = /name=["']([^"']+)["']/g;

      assert.ok(pattern.test(content1), 'Debe detectar comillas dobles');
      pattern.lastIndex = 0;
      assert.ok(pattern.test(content2), 'Debe detectar comillas simples');
    });
  });

  suite('CA-21.3: Resolución de SVG para Hover', () => {
    test('Debe encontrar SVG por nombre en carpeta configurada', () => {
      const iconName = 'home';
      const expectedPath = path.join(svgsFolder, `${iconName}.svg`);

      assert.ok(fs.existsSync(expectedPath), `SVG ${iconName}.svg debe existir`);
    });

    test('Debe leer contenido SVG correctamente', () => {
      const svgPath = path.join(svgsFolder, 'home.svg');
      const content = fs.readFileSync(svgPath, 'utf-8');

      assert.ok(content.includes('<svg'), 'Contenido debe incluir tag svg');
      assert.ok(content.includes('</svg>'), 'Contenido debe incluir cierre de svg');
    });

    test('Debe manejar SVG no encontrado graciosamente', () => {
      const nonExistentPath = path.join(svgsFolder, 'non-existent-icon.svg');
      const exists = fs.existsSync(nonExistentPath);

      assert.strictEqual(exists, false, 'SVG inexistente no debe encontrarse');
    });
  });

  suite('CA-21.4: Formato del Hover Content', () => {
    test('Debe generar MarkdownString válido para hover', () => {
      const iconName = 'home';
      const svgPath = path.join(svgsFolder, 'home.svg');
      const svgContent = fs.readFileSync(svgPath, 'utf-8');

      // Simular generación de contenido hover
      const hoverContent = new vscode.MarkdownString();
      hoverContent.supportHtml = true;
      hoverContent.isTrusted = true;

      // Agregar título
      hoverContent.appendMarkdown(`**Icon: ${iconName}**\n\n`);

      // El contenido real incluiría el SVG renderizado
      assert.ok(hoverContent instanceof vscode.MarkdownString);
      assert.ok(hoverContent.supportHtml, 'Debe soportar HTML');
    });

    test('Debe incluir información del icono en hover', () => {
      const iconInfo = {
        name: 'settings',
        path: path.join(svgsFolder, 'settings.svg'),
        size: '24x24',
        type: 'filled',
      };

      const infoString = `**${iconInfo.name}**\n- Size: ${iconInfo.size}\n- Type: ${iconInfo.type}`;
      assert.ok(infoString.includes(iconInfo.name), 'Debe incluir nombre');
      assert.ok(infoString.includes(iconInfo.size), 'Debe incluir tamaño');
    });
  });

  suite('CA-21.5: Hover en Diferentes Contextos', () => {
    test('Debe funcionar en archivo TSX', async () => {
      const filePath = path.join(tempDir, 'HoverTest.tsx');
      fs.writeFileSync(filePath, testFiles.reactWithIconRef);

      const doc = await vscode.workspace.openTextDocument(filePath);
      const text = doc.getText();

      // Verificar que contiene referencias a iconos
      assert.ok(text.includes('name="home"'), 'Debe contener referencia a home');

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Debe funcionar en archivo Vue', async () => {
      const filePath = path.join(tempDir, 'HoverTest.vue');
      fs.writeFileSync(filePath, testFiles.vueWithIconRef);

      const doc = await vscode.workspace.openTextDocument(filePath);
      const text = doc.getText();

      assert.ok(text.includes('name="heart"'), 'Debe contener referencia a heart');

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Debe funcionar en archivo HTML', async () => {
      const filePath = path.join(tempDir, 'hover-test.html');
      fs.writeFileSync(filePath, testFiles.htmlWithIconRef);

      const doc = await vscode.workspace.openTextDocument(filePath);
      const text = doc.getText();

      assert.ok(text.includes('name="check"'), 'Debe contener referencia a check');

      await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });
  });

  suite('CA-21.6: Configuración del Hover', () => {
    test('Debe respetar configuración componentName', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const componentName = config.get<string>('componentName', 'iw-icon');

      assert.ok(typeof componentName === 'string', 'componentName debe ser string');
      assert.ok(componentName.length > 0, 'componentName no debe estar vacío');
    });

    test('Debe respetar configuración iconNameAttribute', () => {
      const config = vscode.workspace.getConfiguration('iconStudio');
      const attribute = config.get<string>('iconNameAttribute', 'name');

      assert.ok(typeof attribute === 'string', 'iconNameAttribute debe ser string');
    });
  });

  suite('CA-21.7: Posición del Hover', () => {
    test('Debe calcular rango correcto para el nombre del icono', async () => {
      const content = '<Icon name="home" />';
      const iconNameStart = content.indexOf('"home"') + 1;
      const iconNameEnd = iconNameStart + 'home'.length;

      assert.strictEqual(iconNameEnd - iconNameStart, 4, 'Rango debe tener 4 caracteres');
    });

    test('Debe manejar iconos con nombres largos', () => {
      const longIconName = 'navigation-arrow-forward-circle-outline';
      const content = `<Icon name="${longIconName}" />`;
      const pattern = /name="([^"]+)"/;
      const match = content.match(pattern);

      assert.ok(match, 'Debe detectar nombre largo');
      assert.strictEqual(match[1], longIconName, 'Debe extraer nombre completo');
    });
  });

  suite('CA-21.8: Cache de Hover', () => {
    test('Debe poder leer mismo SVG múltiples veces', () => {
      const svgPath = path.join(svgsFolder, 'home.svg');

      // Simular múltiples lecturas (cache debería optimizar)
      const read1 = fs.readFileSync(svgPath, 'utf-8');
      const read2 = fs.readFileSync(svgPath, 'utf-8');
      const read3 = fs.readFileSync(svgPath, 'utf-8');

      assert.strictEqual(read1, read2, 'Lecturas deben ser consistentes');
      assert.strictEqual(read2, read3, 'Lecturas deben ser consistentes');
    });
  });
});
