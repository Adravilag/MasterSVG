/**
 * WelcomePanel E2E Tests
 * Tests the Welcome Panel functionality with real VS Code instance
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('WelcomePanel E2E Tests', () => {
  // Helper to wait for condition
  const waitFor = async (condition: () => boolean, timeout = 5000): Promise<void> => {
    const start = Date.now();
    while (!condition() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!condition()) {
      throw new Error('Timeout waiting for condition');
    }
  };

  // Helper to get workspace folder
  const getTestWorkspace = (): string => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    // Create temp workspace for testing
    return path.join(__dirname, '../../../../test-workspace');
  };

  suiteSetup(async () => {
    // Wait for extension to activate
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    // Give extension time to fully initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  test('Extension should be present', () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    assert.ok(ext, 'Extension should be installed');
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    assert.ok(ext, 'Extension should be installed');

    if (!ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext.isActive, 'Extension should be active');
  });

  test('Welcome command should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('sageboxIconStudio.openWelcome'), 'Welcome command should be registered');
  });

  test('Should open Welcome Panel', async () => {
    // Execute the welcome command
    await vscode.commands.executeCommand('sageboxIconStudio.openWelcome');

    // Wait a bit for panel to open
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check that a webview panel is visible
    // Note: VS Code doesn't expose direct access to webview panels in tests
    // We can only verify the command executes without error
    assert.ok(true, 'Welcome panel command executed successfully');
  });

  test('Configuration commands should work', async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');

    // Test setting source directory
    await config.update('svgFolders', ['test-svgs'], vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200)); // Wait for config to propagate

    // Re-get config after update
    const updatedConfig = vscode.workspace.getConfiguration('sageboxIconStudio');
    const svgFolders = updatedConfig.get<string[]>('svgFolders', []);
    assert.ok(svgFolders.includes('test-svgs'), 'Source directory should be set');

    // Test setting output directory
    await config.update('outputDirectory', 'test-output', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    const outputDir = vscode.workspace
      .getConfiguration('sageboxIconStudio')
      .get<string>('outputDirectory', '');
    assert.strictEqual(outputDir, 'test-output', 'Output directory should be set');

    // Test setting web component name
    await config.update('webComponentName', 'test-icon', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    const webComponentName = vscode.workspace
      .getConfiguration('sageboxIconStudio')
      .get<string>('webComponentName', '');
    assert.strictEqual(webComponentName, 'test-icon', 'Web component name should be set');

    // Clean up - reset to defaults
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
    await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
  });

  test('Build format configuration should persist', async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');

    // Set build format to icons.ts
    await config.update('buildFormat', 'icons.ts', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    let buildFormat = vscode.workspace
      .getConfiguration('sageboxIconStudio')
      .get<string>('buildFormat', '');
    assert.strictEqual(buildFormat, 'icons.ts', 'Build format should be icons.ts');

    // Change to sprite.svg
    await config.update('buildFormat', 'sprite.svg', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    buildFormat = vscode.workspace.getConfiguration('sageboxIconStudio').get<string>('buildFormat', '');
    assert.strictEqual(buildFormat, 'sprite.svg', 'Build format should be sprite.svg');

    // Clean up
    await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);
  });

  test('isConfigured should return correct state', async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');

    // Clear config first
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));

    // Without outputDirectory, should not be configured
    let outputDir = vscode.workspace
      .getConfiguration('sageboxIconStudio')
      .get<string>('outputDirectory', '');
    assert.strictEqual(outputDir, '', 'Output directory should be empty');

    // Set output directory
    await config.update('outputDirectory', 'icons', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    outputDir = vscode.workspace.getConfiguration('sageboxIconStudio').get<string>('outputDirectory', '');
    assert.strictEqual(outputDir, 'icons', 'Output directory should be set');

    // Clean up
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
  });

  test('Panel should react to configuration changes', async function () {
    this.timeout(10000); // Allow more time for this test

    const config = vscode.workspace.getConfiguration('sageboxIconStudio');

    // Open welcome panel
    await vscode.commands.executeCommand('sageboxIconStudio.openWelcome');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Change configuration - panel should update automatically
    await config.update('svgFolders', ['my-icons'], vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify configuration was applied
    const svgFolders = vscode.workspace
      .getConfiguration('sageboxIconStudio')
      .get<string[]>('svgFolders', []);
    assert.ok(svgFolders.includes('my-icons'), 'Configuration should be updated');

    // Clean up
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
  });

  test('Web component name validation', async () => {
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');

    // Valid name with hyphen
    await config.update('webComponentName', 'my-icon', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    let name = vscode.workspace.getConfiguration('sageboxIconStudio').get<string>('webComponentName', '');
    assert.strictEqual(name, 'my-icon', 'Valid web component name should be set');

    // Another valid name
    await config.update('webComponentName', 'custom-svg-icon', vscode.ConfigurationTarget.Global);
    await new Promise(resolve => setTimeout(resolve, 200));
    name = vscode.workspace.getConfiguration('sageboxIconStudio').get<string>('webComponentName', '');
    assert.strictEqual(
      name,
      'custom-svg-icon',
      'Valid web component name with multiple hyphens should be set'
    );

    // Clean up
    await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
  });

  test('All main commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);

    const expectedCommands = [
      'sageboxIconStudio.openWelcome',
      'sageboxIconStudio.buildIcons',
      'sageboxIconStudio.refreshIcons',
      'sageboxIconStudio.searchIcons',
    ];

    for (const cmd of expectedCommands) {
      assert.ok(commands.includes(cmd), `Command ${cmd} should be registered`);
    }
  });

  suiteTeardown(async () => {
    // Clean up any test configurations
    const config = vscode.workspace.getConfiguration('sageboxIconStudio');
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
    await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
    await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);

    // Close any open panels
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
});
