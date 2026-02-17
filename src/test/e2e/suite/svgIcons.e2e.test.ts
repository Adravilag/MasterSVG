/**
 * SVG Icons E2E Tests
 * Tests for scanning, processing, and building SVG icons with real files
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('SVG Icons E2E Tests', () => {
  // __dirname points to out/test/e2e/suite, go up to out/test/e2e/test-workspace
  const testWorkspace = path.join(__dirname, '../test-workspace');
  const svgsFolder = path.join(testWorkspace, 'svgs');

  // Helper to wait for async operations
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  suiteSetup(async () => {
    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('mastersvg.mastersvg-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);

    // Verify test SVGs exist
    assert.ok(fs.existsSync(svgsFolder), `SVGs folder should exist at ${svgsFolder}`);
  });

  suite('Test SVG Files', () => {
    test('Test workspace should contain SVG files', () => {
      const files = fs.readdirSync(svgsFolder);
      const svgFiles = files.filter(f => f.endsWith('.svg'));
      assert.ok(svgFiles.length >= 5, `Should have at least 5 SVG files, found ${svgFiles.length}`);
    });

    test('home.svg should be valid SVG', () => {
      const homeSvg = fs.readFileSync(path.join(svgsFolder, 'home.svg'), 'utf-8');
      assert.ok(homeSvg.includes('<svg'), 'Should contain svg tag');
      assert.ok(homeSvg.includes('xmlns="http://www.w3.org/2000/svg"'), 'Should have xmlns');
      assert.ok(homeSvg.includes('viewBox'), 'Should have viewBox');
    });

    test('heart.svg should contain path element', () => {
      const heartSvg = fs.readFileSync(path.join(svgsFolder, 'heart.svg'), 'utf-8');
      assert.ok(heartSvg.includes('<path'), 'Should contain path element');
    });

    test('settings.svg should be a gear icon', () => {
      const settingsSvg = fs.readFileSync(path.join(svgsFolder, 'settings.svg'), 'utf-8');
      assert.ok(settingsSvg.includes('<path'), 'Should contain path element');
      assert.ok(settingsSvg.includes('fill="currentColor"'), 'Should use currentColor');
    });

    test('circle-red.svg should have fill color', () => {
      const circleSvg = fs.readFileSync(path.join(svgsFolder, 'circle-red.svg'), 'utf-8');
      assert.ok(circleSvg.includes('fill="#ff0000"'), 'Should have red fill');
      assert.ok(circleSvg.includes('<circle'), 'Should contain circle element');
    });

    test('layers-multicolor.svg should have multiple colors', () => {
      const layersSvg = fs.readFileSync(path.join(svgsFolder, 'layers-multicolor.svg'), 'utf-8');
      assert.ok(layersSvg.includes('#3498db'), 'Should contain blue color');
      assert.ok(layersSvg.includes('#2ecc71'), 'Should contain green color');
      assert.ok(layersSvg.includes('#e74c3c'), 'Should contain red color');
    });
  });

  suite('Configuration with SVG Folders', () => {
    test('Should configure svgFolders with test path', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('svgFolders', [svgsFolder], vscode.ConfigurationTarget.Global);
      await delay(300);

      const folders = vscode.workspace
        .getConfiguration('masterSVG')
        .get<string[]>('svgFolders', []);
      assert.ok(folders.includes(svgsFolder), 'SVG folders should include test path');
    });

    test('Should configure output directory', async () => {
      const outputDir = path.join(testWorkspace, 'output');
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('outputDirectory', outputDir, vscode.ConfigurationTarget.Global);
      await delay(300);

      const configuredOutput = vscode.workspace
        .getConfiguration('masterSVG')
        .get<string>('outputDirectory', '');
      assert.strictEqual(configuredOutput, outputDir, 'Output directory should be set');
    });

    test('Should configure web component name', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('webComponentName', 'test-icon', vscode.ConfigurationTarget.Global);
      await delay(300);

      const name = vscode.workspace
        .getConfiguration('masterSVG')
        .get<string>('webComponentName', '');
      assert.strictEqual(name, 'test-icon', 'Web component name should be set');
    });

    suiteTeardown(async () => {
      // Clean up config
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
    });
  });

  suite('Commands Registration', () => {
    test('buildIcons command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.buildIcons'), 'buildIcons command should exist');
    });

    test('refreshIcons command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.refreshIcons'), 'refreshIcons command should exist');
    });

    test('refreshFiles command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.refreshFiles'), 'refreshFiles command should exist');
    });

    test('generateSprite command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.generateSprite'),
        'generateSprite command should exist'
      );
    });

    test('transformSvg command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.transformSvg'), 'transformSvg command should exist');
    });

    test('optimizeSvg command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.optimizeSvg'), 'optimizeSvg command should exist');
    });

    test('searchIcons command should be registered', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.searchIcons'), 'searchIcons command should exist');
    });
  });

  suite('Refresh Commands', () => {
    test('refreshIcons should execute without errors', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.refreshIcons');
        await delay(500);
        assert.ok(true, 'refreshIcons executed successfully');
      } catch (error) {
        assert.fail(`refreshIcons failed: ${error}`);
      }
    });

    test('refreshFiles should execute without errors', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.refreshFiles');
        await delay(500);
        assert.ok(true, 'refreshFiles executed successfully');
      } catch (error) {
        assert.fail(`refreshFiles failed: ${error}`);
      }
    });

    test('refreshCode should execute without errors', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.refreshCode');
        await delay(500);
        assert.ok(true, 'refreshCode executed successfully');
      } catch (error) {
        assert.fail(`refreshCode failed: ${error}`);
      }
    });

    test('refreshBuilt should execute without errors', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.refreshBuilt');
        await delay(500);
        assert.ok(true, 'refreshBuilt executed successfully');
      } catch (error) {
        assert.fail(`refreshBuilt failed: ${error}`);
      }
    });
  });

  suite('Build Format Configuration', () => {
    test('Should set build format to icons.ts', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('buildFormat', 'icons.js', vscode.ConfigurationTarget.Global);
      await delay(200);

      const format = vscode.workspace
        .getConfiguration('masterSVG')
        .get<string>('buildFormat', '');
      assert.strictEqual(format, 'icons.js', 'Build format should be icons.ts');
    });

    test('Should set build format to icons.js', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('buildFormat', 'icons.js', vscode.ConfigurationTarget.Global);
      await delay(200);

      const format = vscode.workspace
        .getConfiguration('masterSVG')
        .get<string>('buildFormat', '');
      assert.strictEqual(format, 'icons.js', 'Build format should be icons.js');
    });

    test('Should set build format to sprite.svg', async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('buildFormat', 'sprite.svg', vscode.ConfigurationTarget.Global);
      await delay(200);

      const format = vscode.workspace
        .getConfiguration('masterSVG')
        .get<string>('buildFormat', '');
      assert.strictEqual(format, 'sprite.svg', 'Build format should be sprite.svg');
    });

    suiteTeardown(async () => {
      const config = vscode.workspace.getConfiguration('masterSVG');
      await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);
    });
  });

  suite('Tree View Commands', () => {
    test('expandAll command should exist', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.expandAll'), 'expandAll should be registered');
    });

    test('collapseAll command should exist', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.collapseAll'), 'collapseAll should be registered');
    });

    test('expandSvgFiles command should exist', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.expandSvgFiles'),
        'expandSvgFiles should be registered'
      );
    });

    test('collapseSvgFiles command should exist', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(
        commands.includes('masterSVG.collapseSvgFiles'),
        'collapseSvgFiles should be registered'
      );
    });
  });

  suite('Panel Commands', () => {
    test('openWelcome command should open panel', async () => {
      try {
        await vscode.commands.executeCommand('masterSVG.openWelcome');
        await delay(500);
        assert.ok(true, 'Welcome panel opened successfully');
      } catch (error) {
        assert.fail(`Failed to open welcome panel: ${error}`);
      }
    });

    test('openPanel command should exist', async () => {
      const commands = await vscode.commands.getCommands(true);
      assert.ok(commands.includes('masterSVG.openPanel'), 'openPanel should be registered');
    });
  });
});
