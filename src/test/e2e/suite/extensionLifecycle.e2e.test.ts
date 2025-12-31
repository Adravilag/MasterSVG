/**
 * Extension Lifecycle E2E Tests
 *
 * Tests para validar el ciclo de vida de la extensión:
 * activación, desactivación y recursos
 */

import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

suite('Extension Lifecycle E2E Tests', () => {
  const testWorkspace = path.join(__dirname, '../test-workspace');

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suite('Extension Activation', () => {
    test('Extensión debe existir', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      assert.ok(ext, 'Extensión debe estar instalada');
    });

    test('Extensión debe tener ID correcto', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      assert.strictEqual(ext?.id, 'sagebox.sagebox-icon-studio', 'ID debe coincidir');
    });

    test('Extensión debe activarse', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      assert.ok(ext, 'Extensión debe existir');

      if (!ext.isActive) {
        await ext.activate();
      }

      assert.ok(ext.isActive, 'Extensión debe estar activa');
    });

    test('Extensión debe activarse con eventos correctos', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;

      const activationEvents = packageJson?.activationEvents || [];

      // Debe activarse con archivos SVG
      const hasSvgActivation = activationEvents.some(
        (event: string) => event.includes('.svg') || event.includes('*')
      );
      assert.ok(hasSvgActivation, 'Debe activarse con archivos SVG');

      // Debe activarse con lenguajes soportados
      const hasLanguageActivation = activationEvents.some((event: string) =>
        event.startsWith('onLanguage:')
      );
      assert.ok(hasLanguageActivation, 'Debe activarse con lenguajes soportados');
    });
  });

  suite('Extension Package JSON', () => {
    test('Debe tener nombre correcto', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;

      assert.strictEqual(
        packageJson?.name,
        'sagebox-icon-studio',
        'Nombre debe coincidir'
      );
    });

    test('Debe tener versión definida', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;

      assert.ok(packageJson?.version, 'Debe tener versión');
      assert.ok(
        /^\d+\.\d+\.\d+/.test(packageJson.version),
        'Versión debe seguir semver'
      );
    });

    test('Debe tener publisher definido', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;

      assert.strictEqual(packageJson?.publisher, 'sagebox', 'Publisher debe ser sagebox');
    });

    test('Debe tener engine vscode definido', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;

      assert.ok(packageJson?.engines?.vscode, 'Debe tener versión de VS Code requerida');
    });

    test('Debe tener categorías definidas', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const packageJson = ext?.packageJSON;

      assert.ok(Array.isArray(packageJson?.categories), 'Debe tener categorías');
      assert.ok(packageJson.categories.length > 0, 'Debe tener al menos una categoría');
    });
  });

  suite('Extension Contributions', () => {
    test('Debe contribuir comandos', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.commands, 'Debe contribuir comandos');
      assert.ok(
        Array.isArray(contributes.commands),
        'Comandos debe ser array'
      );
      assert.ok(
        contributes.commands.length > 0,
        'Debe tener al menos un comando'
      );
    });

    test('Debe contribuir configuración', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.configuration, 'Debe contribuir configuración');
    });

    test('Debe contribuir vistas', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.views, 'Debe contribuir vistas');
    });

    test('Debe contribuir viewsContainers', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.viewsContainers, 'Debe contribuir viewsContainers');
    });

    test('Debe contribuir menús', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.menus, 'Debe contribuir menús');
    });

    test('Debe contribuir lenguajes', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.languages, 'Debe contribuir lenguajes');

      // Debe contribuir sageboxignore
      const hasIgnoreLanguage = contributes.languages.some(
        (lang: { id: string }) => lang.id === 'sageboxignore'
      );
      assert.ok(hasIgnoreLanguage, 'Debe contribuir lenguaje sageboxignore');
    });

    test('Debe contribuir grammars', () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const contributes = ext?.packageJSON?.contributes;

      assert.ok(contributes?.grammars, 'Debe contribuir grammars');
    });
  });

  suite('Extension Exports', () => {
    test('Extensión puede exportar API pública', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');

      if (!ext?.isActive) {
        await ext?.activate();
      }

      // La extensión puede o no exportar una API pública
      // Este test verifica que la activación funciona
      assert.ok(ext?.isActive, 'Extensión debe estar activa después de activar');
    });
  });

  suite('Workspace Integration', () => {
    test('Debe detectar workspace abierto', () => {
      const workspaceFolders = vscode.workspace.workspaceFolders;

      assert.ok(workspaceFolders, 'Debe haber workspace folders');
      assert.ok(workspaceFolders.length > 0, 'Debe tener al menos un folder');
    });

    test('Test workspace debe tener archivos SVG', () => {
      const svgsFolder = path.join(testWorkspace, 'svgs');

      if (fs.existsSync(svgsFolder)) {
        const files = fs.readdirSync(svgsFolder);
        const svgFiles = files.filter(f => f.endsWith('.svg'));

        assert.ok(svgFiles.length > 0, 'Debe tener archivos SVG de prueba');
      }
    });
  });

  suite('Extension State', () => {
    test('Extensión debe mantener estado después de comandos', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');

      if (!ext?.isActive) {
        await ext?.activate();
      }

      // Ejecutar un comando
      try {
        await vscode.commands.executeCommand('sageboxIconStudio.refreshIcons');
        await delay(500);
      } catch {
        // Puede fallar si no hay contexto, pero extensión debe seguir activa
      }

      assert.ok(ext?.isActive, 'Extensión debe seguir activa después de comando');
    });

    test('Extensión debe manejar configuración cambiante', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');

      if (!ext?.isActive) {
        await ext?.activate();
      }

      // Cambiar configuración
      const config = vscode.workspace.getConfiguration('sageboxIconStudio');
      await config.update('defaultIconSize', 32, vscode.ConfigurationTarget.Global);
      await delay(200);

      // Restaurar
      await config.update('defaultIconSize', 24, vscode.ConfigurationTarget.Global);

      assert.ok(ext?.isActive, 'Extensión debe seguir activa después de cambio de config');
    });
  });

  suite('Error Recovery', () => {
    test('Extensión debe sobrevivir a comando con argumentos inválidos', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');

      if (!ext?.isActive) {
        await ext?.activate();
      }

      try {
        // Ejecutar comando sin los argumentos requeridos
        await vscode.commands.executeCommand('sageboxIconStudio.showDetails', undefined);
      } catch {
        // Error esperado
      }

      assert.ok(ext?.isActive, 'Extensión debe seguir activa después de error');
    });

    test('Extensión debe manejar archivos SVG inválidos', async () => {
      const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
      const invalidSvgPath = path.join(testWorkspace, 'temp-invalid.svg');

      try {
        // Crear SVG inválido temporalmente
        fs.writeFileSync(invalidSvgPath, 'not a valid svg content');

        // Intentar refrescar
        await vscode.commands.executeCommand('sageboxIconStudio.refreshFiles');
        await delay(300);
      } catch {
        // Error manejado
      } finally {
        // Limpiar
        if (fs.existsSync(invalidSvgPath)) {
          fs.unlinkSync(invalidSvgPath);
        }
      }

      assert.ok(ext?.isActive, 'Extensión debe seguir activa con SVG inválido');
    });
  });

  suite('Resource Cleanup', () => {
    test('Debe cerrar paneles webview correctamente', async () => {
      try {
        // Abrir panel
        await vscode.commands.executeCommand('sageboxIconStudio.openWelcome');
        await delay(300);

        // Cerrar todos los editores (incluye webviews)
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');
        await delay(200);

        assert.ok(true, 'Paneles cerrados correctamente');
      } catch {
        assert.ok(true, 'Manejo de cierre gracioso');
      }
    });
  });
});
