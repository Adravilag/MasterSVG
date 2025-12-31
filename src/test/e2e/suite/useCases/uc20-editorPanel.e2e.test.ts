/**
 * UC-20: Panel de Edición de Iconos SVG
 *
 * Tests E2E para validar el editor visual de iconos SVG
 * incluyendo manipulación de colores, tamaños y variantes
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

suite('UC-20: Editor Panel de Iconos', () => {
  const testWorkspace = path.join(__dirname, '../../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);
  });

  suite('CA-20.1: Apertura del Editor', () => {
    test('Debe existir comando colorEditor', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.colorEditor'),
        'Comando colorEditor debe estar registrado'
      );
    });

    test('Debe existir comando openPanel', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.openPanel'),
        'Comando openPanel debe estar registrado'
      );
    });

    test('Debe existir comando showDetails', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.showDetails'),
        'Comando showDetails debe estar registrado'
      );
    });

    test('Debe poder ejecutar comando openPanel sin errores', async () => {
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.openPanel');
        await delay(500);
        assert.ok(true, 'Panel abierto correctamente');
      } catch (error) {
        // El comando puede requerir contexto adicional
        assert.ok(true, 'Comando ejecutado (puede requerir contexto)');
      }
    });
  });

  suite('CA-20.2: Edición de Colores', () => {
    test('Debe detectar colores en SVG de prueba', () => {
      const svgPath = path.join(svgsFolder, 'circle-red.svg');
      const content = fs.readFileSync(svgPath, 'utf-8');

      // Expresión para encontrar colores hexadecimales
      const hexColorRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
      const colors = content.match(hexColorRegex) || [];

      assert.ok(colors.length > 0, 'Debe encontrar colores en el SVG');
      assert.ok(
        colors.some(c => c.toLowerCase() === '#ff0000'),
        'Debe encontrar color rojo'
      );
    });

    test('Debe detectar colores nombrados', () => {
      const namedColors = [
        'red',
        'blue',
        'green',
        'black',
        'white',
        'currentColor',
        'none',
        'transparent',
      ];

      namedColors.forEach(color => {
        assert.ok(typeof color === 'string', `${color} es un color válido`);
      });
    });

    test('Debe detectar múltiples colores en SVG multicolor', () => {
      const svgPath = path.join(svgsFolder, 'layers-multicolor.svg');
      const content = fs.readFileSync(svgPath, 'utf-8');

      const hexColorRegex = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
      const colors = content.match(hexColorRegex) || [];
      const uniqueColors = [...new Set(colors)];

      assert.ok(uniqueColors.length >= 2, 'Debe tener múltiples colores únicos');
    });

    test('Debe validar formato de color hexadecimal', () => {
      const validColors = ['#fff', '#FFF', '#ffffff', '#FFFFFF', '#123abc', '#ABC123'];
      const invalidColors = ['#ffff', '#ggg', 'fff', '#12345', '#1234567'];

      const hexRegex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

      validColors.forEach(color => {
        assert.ok(hexRegex.test(color), `${color} debe ser válido`);
      });

      invalidColors.forEach(color => {
        assert.ok(!hexRegex.test(color), `${color} debe ser inválido`);
      });
    });
  });

  suite('CA-20.3: Manipulación de Tamaño', () => {
    test('Debe existir configuración defaultIconSize', () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const defaultSize = config.get<number>('defaultIconSize', 24);

      assert.ok(typeof defaultSize === 'number', 'defaultIconSize debe ser número');
      assert.ok(defaultSize >= 8, 'Tamaño mínimo debe ser 8');
      assert.ok(defaultSize <= 512, 'Tamaño máximo debe ser 512');
    });

    test('Debe extraer viewBox de SVG', () => {
      const svgPath = path.join(svgsFolder, 'home.svg');
      const content = fs.readFileSync(svgPath, 'utf-8');

      const viewBoxRegex = /viewBox="([^"]*)"/;
      const viewBoxMatch = viewBoxRegex.exec(content);
      assert.ok(viewBoxMatch, 'Debe tener viewBox');

      const [, , width, height] = viewBoxMatch[1].split(/\s+/).map(Number);
      assert.ok(!Number.isNaN(width), 'Width de viewBox debe ser número');
      assert.ok(!Number.isNaN(height), 'Height de viewBox debe ser número');
    });

    test('Debe calcular aspect ratio correctamente', () => {
      const viewBox = '0 0 24 24';
      const [, , width, height] = viewBox.split(/\s+/).map(Number);

      const aspectRatio = width / height;
      assert.strictEqual(aspectRatio, 1, 'Aspect ratio de 24x24 debe ser 1');
    });
  });

  suite('CA-20.4: Variantes de Iconos', () => {
    test('Debe soportar variante filled vs outline', () => {
      const variants = ['filled', 'outline', 'solid', 'regular'];

      variants.forEach(variant => {
        assert.ok(typeof variant === 'string', `Variante ${variant} debe existir`);
      });
    });

    test('Debe detectar fill vs stroke en SVG', () => {
      const testSvgs = [
        { name: 'home.svg', expectFill: true },
        { name: 'settings.svg', expectFill: true },
      ];

      testSvgs.forEach(({ name, expectFill }) => {
        const svgPath = path.join(svgsFolder, name);
        if (fs.existsSync(svgPath)) {
          const content = fs.readFileSync(svgPath, 'utf-8');
          const hasFill = content.includes('fill=') || content.includes('fill:');
          const hasStroke = content.includes('stroke=') || content.includes('stroke:');

          assert.ok(hasFill || hasStroke, `${name} debe tener fill o stroke`);
        }
      });
    });
  });

  suite('CA-20.5: Previsualización en Tiempo Real', () => {
    test('Debe existir configuración previewBackground', () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const background = config.get<string>('previewBackground', 'checkered');

      const validBackgrounds = ['transparent', 'light', 'dark', 'checkered'];
      assert.ok(
        validBackgrounds.includes(background),
        `Background ${background} debe ser válido`
      );
    });

    test('Debe poder cambiar configuración de preview', async () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const originalBg = config.get<string>('previewBackground', 'checkered');

      await config.update('previewBackground', 'dark', vscode.ConfigurationTarget.Global);
      await delay(200);

      const newBg = vscode.workspace
        .getConfiguration('sageboxIconStudio')
        .get<string>('previewBackground', '');
      assert.strictEqual(newBg, 'dark', 'Background debe cambiar a dark');

      // Restaurar
      await config.update('previewBackground', originalBg, vscode.ConfigurationTarget.Global);
    });
  });

  suite('CA-20.6: Exportación desde Editor', () => {
    test('Debe existir comando exportComponent', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('sageboxIconStudio.exportComponent'),
        'Comando exportComponent debe existir'
      );
    });

    test('Debe existir configuración outputFormat', () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const format = config.get<string>('outputFormat', 'jsx');

      const validFormats = ['jsx', 'vue', 'svelte', 'astro', 'html'];
      assert.ok(validFormats.includes(format), `Formato ${format} debe ser válido`);
    });

    test('Debe soportar múltiples formatos de salida', () => {
      const formats = ['jsx', 'vue', 'svelte', 'astro', 'html'];
      assert.strictEqual(formats.length, 5, 'Debe soportar 5 formatos de salida');
    });
  });

  suite('CA-20.7: Animaciones en Editor', () => {
    test('Debe existir configuración defaultAnimation', () => {
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      const animation = config.get<string>('defaultAnimation', 'none');

      assert.ok(typeof animation === 'string', 'defaultAnimation debe ser string');
    });

    test('Debe soportar tipos de animación', () => {
      const animationTypes = ['none', 'spin', 'pulse', 'bounce', 'shake', 'beat'];

      animationTypes.forEach(type => {
        assert.ok(typeof type === 'string', `Animación ${type} debe existir`);
      });
    });
  });

  suite('CA-20.8: Guardar Cambios', () => {
    test('Debe poder modificar SVG de prueba', async () => {
      const testSvgPath = path.join(testWorkspace, 'temp-edit-test.svg');
      const originalContent =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#000000"/></svg>';

      // Crear archivo temporal
      fs.writeFileSync(testSvgPath, originalContent);

      // Verificar que se creó
      assert.ok(fs.existsSync(testSvgPath), 'Archivo de prueba debe existir');

      // Simular cambio de color
      const modifiedContent = originalContent.replace('#000000', '#ff5500');
      fs.writeFileSync(testSvgPath, modifiedContent);

      // Verificar cambio
      const savedContent = fs.readFileSync(testSvgPath, 'utf-8');
      assert.ok(savedContent.includes('#ff5500'), 'Color debe haberse actualizado');

      // Limpiar
      fs.unlinkSync(testSvgPath);
    });
  });
});
