import * as vscode from 'vscode';
import { SvgOptimizer } from '../services/SvgOptimizer';
import { getSvgConfig } from '../utils/config';
import { clearTempIcons } from '../providers/WorkspaceSvgProvider';

interface IconData {
  name: string;
  svg: string;
  location?: { file: string; line: number };
}

const svgOptimizer = new SvgOptimizer();

export class IconEditorPanel {
  public static currentPanel: IconEditorPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _iconData?: IconData;
  private _originalColors: string[] = [];
  private _selectedVariantIndex: number = -1;

  public static createOrShow(extensionUri: vscode.Uri, data?: IconData) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (IconEditorPanel.currentPanel) {
      IconEditorPanel.currentPanel._panel.reveal(column);
      if (data) {
        IconEditorPanel.currentPanel._iconData = data;
        IconEditorPanel.currentPanel._originalColors = IconEditorPanel.currentPanel._extractColorsFromSvg(data.svg).colors;
        IconEditorPanel.currentPanel._selectedVariantIndex = -1;
        IconEditorPanel.currentPanel._update();
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'iconEditor',
      'Icon Editor',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    IconEditorPanel.currentPanel = new IconEditorPanel(panel, extensionUri, data);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, data?: IconData) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._iconData = data;
    if (data) {
      this._originalColors = this._extractColorsFromSvg(data.svg).colors;
    }

    this._update();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Reveal in tree view when panel becomes visible (tab selected)
    this._panel.onDidChangeViewState(e => {
      if (e.webviewPanel.visible && this._iconData) {
        vscode.commands.executeCommand('iconManager.revealInTree', this._iconData.name, this._iconData.location?.file, this._iconData.location?.line);
      }
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'previewColor':
            // Only update preview, don't regenerate swatches (picker is still open)
            if (this._iconData?.svg && message.oldColor && message.newColor) {
              const updatedSvg = this._replaceColorInSvg(this._iconData.svg, message.oldColor, message.newColor);
              this._panel.webview.postMessage({
                command: 'previewUpdated',
                svg: updatedSvg
              });
            }
            break;
          case 'changeColor':
            // Full update when picker closes - update data and regenerate swatches
            if (this._iconData?.svg && message.oldColor && message.newColor) {
              const updatedSvg = this._replaceColorInSvg(this._iconData.svg, message.oldColor, message.newColor);
              this._iconData.svg = updatedSvg;
              const { colors } = this._extractColorsFromSvg(updatedSvg);

              // If a custom variant is selected (not original), update it with new colors
              if (this._selectedVariantIndex >= 0) {
                this._updateVariantColors(this._iconData.name, this._selectedVariantIndex, colors);
              }

              // Full refresh to update Variants display
              this._update();
            }
            break;
          case 'addColor':
            if (this._iconData?.svg && message.color) {
              let updatedSvg = this._iconData.svg;
              if (updatedSvg.includes('fill=')) {
                updatedSvg = updatedSvg.replace(/<svg([^>]*)fill=["'][^"']*["']/, `<svg$1fill="${message.color}"`);
              } else {
                updatedSvg = updatedSvg.replace(/<svg/, `<svg fill="${message.color}"`);
              }
              this._iconData.svg = updatedSvg;
              this._update();
            }
            break;
          case 'optimizeSvg':
            if (this._iconData?.svg) {
              const preset = message.preset || 'safe';
              const presets = svgOptimizer.getPresets();
              const result = svgOptimizer.optimize(this._iconData.svg, presets[preset] || presets.safe);

              this._panel.webview.postMessage({
                command: 'optimizeResult',
                ...result,
                originalSizeStr: svgOptimizer.formatSize(result.originalSize),
                optimizedSizeStr: svgOptimizer.formatSize(result.optimizedSize)
              });
            }
            break;
          case 'applyOptimizedSvg':
            if (this._iconData && message.svg) {
              this._iconData.svg = message.svg;
              
              // Save automatically
              if (this._iconData.location) {
                await this._saveSvgToFile(this._iconData.svg);
              } else {
                await this._updateBuiltIconsFile(this._iconData.svg);
              }

              // Instead of full update, just notify webview
              this._panel.webview.postMessage({
                command: 'optimizedSvgApplied',
                svg: this._iconData.svg,
                code: this._highlightSvgCode(this._iconData.svg)
              });
              
              // Refresh tree view
              vscode.commands.executeCommand('iconManager.refreshIcons');

              vscode.window.showInformationMessage('Optimized SVG applied and saved');
            }
            break;
          case 'save':
            if (this._iconData?.svg) {
              let svgToSave = this._iconData.svg;

              // Always clean up old animations first (to avoid duplicates or stale code)
              svgToSave = this._cleanAnimationFromSvg(svgToSave);
              
              // Always ensure namespace is correct (fixes "Error loading image" in VS Code)
              svgToSave = this._ensureSvgNamespace(svgToSave);

              // If animation is included in the view, embed it into the file
              if (message.includeAnimation && message.animation && message.animation !== 'none') {
                svgToSave = this._embedAnimationInSvg(
                  svgToSave,
                  message.animation,
                  message.settings
                );
              }
              
              // Update internal state to match the saved file
              this._iconData.svg = svgToSave;

              await this._saveSvgToFile(svgToSave);
              // Update original colors to current colors after save
              this._originalColors = this._extractColorsFromSvg(svgToSave).colors;
              // Refresh the panel to show updated "original" in variants
              this._update();
              // Clear temp icons cache to force regeneration with new content
              clearTempIcons();
              // Refresh the tree view to show updated icons
              await vscode.commands.executeCommand('iconManager.refreshIcons');
            }
            break;
          case 'copySvg':
            const svgToCopy = message.svg || this._iconData?.svg;
            if (svgToCopy) {
              vscode.env.clipboard.writeText(svgToCopy);
              vscode.window.showInformationMessage('SVG copied to clipboard');
            }
            break;
          case 'copyWithAnimation':
            if (this._iconData?.svg && message.animation && message.animation !== 'none') {
              const animatedSvg = this._embedAnimationInSvg(
                this._iconData.svg,
                message.animation,
                message.settings
              );
              vscode.env.clipboard.writeText(animatedSvg);
              vscode.window.showInformationMessage('Animated SVG copied to clipboard');
            }
            break;
          case 'goToSource':
            if (this._iconData?.location) {
              const uri = vscode.Uri.file(this._iconData.location.file);
              const position = new vscode.Position(this._iconData.location.line - 1, 0);
              vscode.window.showTextDocument(uri, {
                selection: new vscode.Range(position, position),
                preview: false
              });
              // Also reveal in tree view
              if (this._iconData.name) {
                vscode.commands.executeCommand('iconManager.revealInTree', this._iconData.name, this._iconData.location.file, this._iconData.location.line);
              }
            }
            break;
          case 'requestRename':
            // Show VS Code input box for rename
            if (this._iconData && message.currentName) {
              const newName = await vscode.window.showInputBox({
                prompt: 'Enter new name for the icon',
                value: message.currentName,
                placeHolder: 'icon-name',
                validateInput: (value) => {
                  if (!value || value.trim() === '') {
                    return 'Name cannot be empty';
                  }
                  if (value === message.currentName) {
                    return 'Enter a different name';
                  }
                  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
                    return 'Name can only contain letters, numbers, dashes and underscores';
                  }
                  return undefined;
                }
              });

              if (newName) {
                // Execute the rename
                try {
                  const result = await vscode.commands.executeCommand<{ newName: string; newPath?: string } | undefined>('iconManager.renameIcon', {
                    icon: {
                      name: message.currentName,
                      path: this._iconData.location?.file,
                      svg: this._iconData.svg
                    },
                    contextValue: this._iconData.location ? 'svgIcon' : 'builtIcon'
                  }, newName);

                  if (result) {
                    // Update the panel with new name
                    this._iconData.name = result.newName;

                    // If it's an SVG file, update the path too
                    if (result.newPath && this._iconData.location) {
                      this._iconData.location.file = result.newPath;
                    }

                    this._panel.title = `Edit: ${result.newName}`;
                    this._panel.webview.postMessage({ command: 'nameUpdated', newName: result.newName });
                    vscode.window.showInformationMessage(`Renamed to "${result.newName}"`);

                    // Reveal the renamed icon in tree view
                    vscode.commands.executeCommand('iconManager.revealInTree', result.newName, result.newPath || this._iconData.location?.file, this._iconData.location?.line);
                  }
                } catch (error) {
                  vscode.window.showErrorMessage(`Error renaming: ${error}`);
                }
              }
            }
            break;
          case 'renameIcon':
            if (this._iconData && message.oldName && message.newName) {
              try {
                // Execute the rename command with the new name
                const result = await vscode.commands.executeCommand<{ newName: string; newPath?: string } | undefined>('iconManager.renameIcon', {
                  icon: {
                    name: message.oldName,
                    path: this._iconData.location?.file,
                    svg: this._iconData.svg
                  },
                  contextValue: this._iconData.location ? 'svgIcon' : 'builtIcon'
                }, message.newName);

                if (result) {
                  // Update the panel with the new name
                  this._iconData.name = result.newName;

                  // If it's an SVG file, update the path too
                  if (result.newPath && this._iconData.location) {
                    this._iconData.location.file = result.newPath;
                  }

                  this._panel.title = `Edit: ${result.newName}`;
                  this._update();
                  vscode.window.showInformationMessage(`Renamed to "${result.newName}"`);

                  // Reveal the renamed icon in tree view
                  vscode.commands.executeCommand('iconManager.revealInTree', result.newName, result.newPath || this._iconData.location?.file, this._iconData.location?.line);
                }
              } catch (error) {
                vscode.window.showErrorMessage(`Error renaming icon: ${error}`);
              }
            }
            break;
          case 'rebuild':
            // Save current changes
            if (this._iconData?.svg) {
              // Save animation to animations.js if provided
              if (message.animation && message.animation !== 'none') {
                await this._saveAnimation(this._iconData.name, message.animation, message.animationSettings);
              } else {
                await this._removeAnimation(this._iconData.name);
              }

              if (this._iconData.location) {
                // Has source file - save to it first, then rebuild all
                await this._saveSvgToFile(this._iconData.svg);
                vscode.commands.executeCommand('iconManager.buildIcons');
              } else {
                // No source file (built icon) - only update icons.js directly
                // Don't call buildIcons as it would overwrite with stale data
                const updated = await this._updateBuiltIconsFile(this._iconData.svg);
                if (updated) {
                  vscode.window.showInformationMessage('Icon updated in icons.js' + (message.animation ? ' with animation' : ''));
                  // Force full refresh to reload from disk
                  await vscode.commands.executeCommand('iconManager.refreshIcons');
                  // Small delay to let refresh complete, then fire tree update
                  setTimeout(() => {
                    vscode.commands.executeCommand('iconManager.refreshIcons');
                  }, 200);
                } else {
                  vscode.window.showWarningMessage('Could not find icons.js to update');
                }
              }
            }
            break;
          case 'refresh':
            vscode.commands.executeCommand('iconManager.refreshIcons');
            break;
          case 'saveVariant':
            if (this._iconData) {
              const variantName = await vscode.window.showInputBox({
                prompt: 'Enter variant name',
                placeHolder: 'e.g. Dark theme, Primary colors...'
              });
              if (variantName) {
                const { colors } = this._extractColorsFromSvg(this._iconData.svg);
                this._saveVariant(this._iconData.name, variantName, colors);
                this._update();
                vscode.window.showInformationMessage(`Variant "${variantName}" saved`);
              }
            }
            break;
          case 'applyVariant':
            if (this._iconData && message.index !== undefined) {
              const Variants = this._getSavedVariants(this._iconData.name);
              const variant = Variants[message.index];
              if (variant) {
                const currentColors = this._extractColorsFromSvg(this._iconData.svg).colors;
                let newSvg = this._iconData.svg;

                // Replace colors in order
                for (let i = 0; i < Math.min(currentColors.length, variant.colors.length); i++) {
                  newSvg = this._replaceColorInSvg(newSvg, currentColors[i], variant.colors[i]);
                }

                this._iconData.svg = newSvg;
                this._selectedVariantIndex = message.index;
                this._update();
              }
            }
            break;
          case 'applyDefaultVariant':
            if (this._iconData && this._originalColors.length > 0) {
              const currentColors = this._extractColorsFromSvg(this._iconData.svg).colors;
              let newSvg = this._iconData.svg;

              // Replace colors back to original
              for (let i = 0; i < Math.min(currentColors.length, this._originalColors.length); i++) {
                newSvg = this._replaceColorInSvg(newSvg, currentColors[i], this._originalColors[i]);
              }

              this._iconData.svg = newSvg;
              this._selectedVariantIndex = -1;
              this._update();
            }
            break;
          case 'generateAutoVariant':
            if (this._iconData && message.type) {
              this._generateAutoVariant(message.type);
            }
            break;
          case 'deleteVariant':
            if (this._iconData && message.index !== undefined) {
              this._deleteVariant(this._iconData.name, message.index);
              // If deleted variant was the default, clear default
              const Variants = this._getSavedVariants(this._iconData.name);
              const variantNames = Variants.map(s => s.name);
              const currentDefault = this._getDefaultVariant(this._iconData.name);
              if (currentDefault && !variantNames.includes(currentDefault)) {
                this._setDefaultVariant(this._iconData.name, null);
              }
              if (this._selectedVariantIndex === message.index) {
                this._selectedVariantIndex = -1;
              } else if (this._selectedVariantIndex > message.index) {
                this._selectedVariantIndex--;
              }
              this._update();
            }
            break;
          case 'setDefaultVariant':
            if (this._iconData) {
              const variantName = message.variantName; // null to clear, string to set
              this._setDefaultVariant(this._iconData.name, variantName);
              this._update();
              if (variantName) {
                vscode.window.showInformationMessage(`"${variantName}" is now the default Variant for ${this._iconData.name}`);
              } else {
                vscode.window.showInformationMessage(`default variant cleared for ${this._iconData.name}`);
              }
            }
            break;
          case 'editVariant':
            if (this._iconData && message.index !== undefined) {
              const Variants = this._getSavedVariants(this._iconData.name);
              const variant = Variants[message.index];
              if (variant) {
                const newName = await vscode.window.showInputBox({
                  prompt: 'Edit variant name',
                  value: variant.name,
                  placeHolder: 'e.g. Dark theme, Primary colors...'
                });
                if (newName !== undefined) {
                  // Update variant with current colors
                  const { colors } = this._extractColorsFromSvg(this._iconData.svg);
                  this._updateVariant(this._iconData.name, message.index, newName, colors);
                  this._update();
                  vscode.window.showInformationMessage(`Variant "${newName}" updated`);
                }
              }
            }
            break;
          case 'showMessage':
            if (message.message) {
              vscode.window.showInformationMessage(message.message);
            }
            break;
          case 'formatSvgCode':
            if (this._iconData?.svg) {
              this._panel.webview.postMessage({
                command: 'updateCodeTab',
                code: this._highlightSvgCode(this._iconData.svg)
              });
            }
            break;
          case 'updateCodeWithAnimation':
            if (this._iconData?.svg) {
              let svgToShow = this._iconData.svg;
              let hasAnimation = false;

              // If animation should be included, embed it
              if (message.includeAnimation && message.animation && message.animation !== 'none') {
                svgToShow = this._embedAnimationInSvg(
                  this._iconData.svg,
                  message.animation,
                  message.settings
                );
                hasAnimation = true;
              }

              this._panel.webview.postMessage({
                command: 'updateCodeTab',
                code: this._highlightSvgCode(svgToShow),
                size: Buffer.byteLength(svgToShow, 'utf8'),
                hasAnimation: hasAnimation
              });
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  // Variants storage methods - use variants.js in output directory
  private _getVariantsFilePath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !outputDir) return undefined;

    const path = require('path');
    return path.join(workspaceFolders[0].uri.fsPath, outputDir, 'variants.js');
  }

  private _readVariantsFromFile(): Record<string, Record<string, string[]>> {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return {};

      const fs = require('fs');
      if (!fs.existsSync(filePath)) return {};

      const content = fs.readFileSync(filePath, 'utf-8');
      // Parse: export const Variants = { ... };
      const match = content.match(/export\s+const\s+Variants\s*=\s*(\{[\s\S]*\});/);
      if (match) {
        // Use Function to safely parse the object literal
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  private _writeVariantsToFile(allVariants: Record<string, Record<string, string[]>>): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return;

      const fs = require('fs');
      const path = require('path');

      // Ensure output directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Read existing defaults
      const defaults = this._readDefaultVariants();

      // Generate variants.js content
      let content = '// Auto-generated by Icon Manager\n';
      content += '// Variants for icons - edit freely or use the Icon Editor\n\n';

      // Export default Variants mapping
      content += '// Default Variant for each icon (used when no variant attribute is specified)\n';
      content += 'export const defaultVariants = {\n';
      const defaultEntries = Object.entries(defaults);
      defaultEntries.forEach(([iconName, variantName], idx) => {
        content += `  '${iconName}': '${variantName}'`;
        content += idx < defaultEntries.length - 1 ? ',\n' : '\n';
      });
      content += '};\n\n';

      content += 'export const Variants = {\n';

      const iconEntries = Object.entries(allVariants);
      iconEntries.forEach(([iconName, iconVariants], iconIdx) => {
        content += `  '${iconName}': {\n`;
        const variantEntries = Object.entries(iconVariants);
        variantEntries.forEach(([variantName, colors], variantIdx) => {
          const colorsStr = colors.map(c => `'${c}'`).join(', ');
          content += `    '${variantName}': [${colorsStr}]`;
          content += variantIdx < variantEntries.length - 1 ? ',\n' : '\n';
        });
        content += `  }`;
        content += iconIdx < iconEntries.length - 1 ? ',\n' : '\n';
      });

      content += '};\n';

      fs.writeFileSync(filePath, content);
    } catch (error) {
      console.error('Error writing Variants:', error);
    }
  }

  private _getSavedVariants(iconName: string): Array<{ name: string; colors: string[] }> {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName] || {};
    return Object.entries(iconVariants).map(([name, colors]) => ({ name, colors }));
  }

  private _readDefaultVariants(): Record<string, string> {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return {};

      const fs = require('fs');
      if (!fs.existsSync(filePath)) return {};

      const content = fs.readFileSync(filePath, 'utf-8');
      // Parse: export const defaultVariants = { ... };
      const match = content.match(/export\s+const\s+defaultVariants\s*=\s*(\{[\s\S]*?\});/);
      if (match) {
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  private _getDefaultVariant(iconName: string): string | null {
    const defaults = this._readDefaultVariants();
    return defaults[iconName] || null;
  }

  private _setDefaultVariant(iconName: string, variantName: string | null): void {
    const defaults = this._readDefaultVariants();
    if (variantName) {
      defaults[iconName] = variantName;
    } else {
      delete defaults[iconName];
    }
    // Rewrite the Variants file with updated defaults
    const allVariants = this._readVariantsFromFile();
    this._writeVariantsToFileWithDefaults(allVariants, defaults);
  }

  private _writeVariantsToFileWithDefaults(allVariants: Record<string, Record<string, string[]>>, defaults: Record<string, string>): void {
    try {
      const filePath = this._getVariantsFilePath();
      if (!filePath) return;

      const fs = require('fs');
      const path = require('path');

      // Ensure output directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Generate variants.js content
      let content = '// Auto-generated by Icon Manager\n';
      content += '// Variants for icons - edit freely or use the Icon Editor\n\n';

      // Export default Variants mapping
      content += '// Default Variant for each icon (used when no variant attribute is specified)\n';
      content += 'export const defaultVariants = {\n';
      const defaultEntries = Object.entries(defaults);
      defaultEntries.forEach(([iconName, variantName], idx) => {
        content += `  '${iconName}': '${variantName}'`;
        content += idx < defaultEntries.length - 1 ? ',\n' : '\n';
      });
      content += '};\n\n';

      content += 'export const Variants = {\n';

      const iconEntries = Object.entries(allVariants);
      iconEntries.forEach(([iconName, iconVariants], iconIdx) => {
        content += `  '${iconName}': {\n`;
        const variantEntries = Object.entries(iconVariants);
        variantEntries.forEach(([variantName, colors], variantIdx) => {
          const colorsStr = colors.map(c => `'${c}'`).join(', ');
          content += `    '${variantName}': [${colorsStr}]`;
          content += variantIdx < variantEntries.length - 1 ? ',\n' : '\n';
        });
        content += `  }`;
        content += iconIdx < iconEntries.length - 1 ? ',\n' : '\n';
      });

      content += '};\n';

      fs.writeFileSync(filePath, content);
    } catch (error) {
      console.error('Error writing Variants:', error);
    }
  }

  private _saveVariant(iconName: string, variantName: string, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    if (!allVariants[iconName]) {
      allVariants[iconName] = {};
    }
    allVariants[iconName][variantName] = colors;
    this._writeVariantsToFile(allVariants);
  }

  private _deleteVariant(iconName: string, index: number): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (iconVariants) {
      const variantNames = Object.keys(iconVariants);
      if (variantNames[index]) {
        delete allVariants[iconName][variantNames[index]];
        if (Object.keys(allVariants[iconName]).length === 0) {
          delete allVariants[iconName];
        }
        this._writeVariantsToFile(allVariants);
      }
    }
  }

  private _updateVariant(iconName: string, index: number, newName: string, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (iconVariants) {
      const variantNames = Object.keys(iconVariants);
      const oldName = variantNames[index];
      if (oldName) {
        // Remove old, add new
        delete allVariants[iconName][oldName];
        allVariants[iconName][newName] = colors;
        this._writeVariantsToFile(allVariants);
      }
    }
  }

  private _updateVariantColors(iconName: string, index: number, colors: string[]): void {
    const allVariants = this._readVariantsFromFile();
    const iconVariants = allVariants[iconName];
    if (iconVariants) {
      const variantNames = Object.keys(iconVariants);
      const variantName = variantNames[index];
      if (variantName) {
        // Update colors keeping the same name
        allVariants[iconName][variantName] = colors;
        this._writeVariantsToFile(allVariants);
      }
    }
  }

  // ==================== Auto-generate Variants ====================

  private _hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  private _rgbToHex(r: number, g: number, b: number): string {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
  }

  private _invertColor(hex: string): string {
    const rgb = this._hexToRgb(hex);
    if (!rgb) return hex;
    return this._rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
  }

  private _darkenColor(hex: string, amount: number = 0.3): string {
    const rgb = this._hexToRgb(hex);
    if (!rgb) return hex;
    return this._rgbToHex(
      rgb.r * (1 - amount),
      rgb.g * (1 - amount),
      rgb.b * (1 - amount)
    );
  }

  private _lightenColor(hex: string, amount: number = 0.3): string {
    const rgb = this._hexToRgb(hex);
    if (!rgb) return hex;
    return this._rgbToHex(
      rgb.r + (255 - rgb.r) * amount,
      rgb.g + (255 - rgb.g) * amount,
      rgb.b + (255 - rgb.b) * amount
    );
  }

  private _desaturateColor(hex: string, amount: number = 0.5): string {
    const rgb = this._hexToRgb(hex);
    if (!rgb) return hex;
    const gray = rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114;
    return this._rgbToHex(
      rgb.r + (gray - rgb.r) * amount,
      rgb.g + (gray - rgb.g) * amount,
      rgb.b + (gray - rgb.b) * amount
    );
  }

  private _generateAutoVariant(type: 'invert' | 'darken' | 'lighten' | 'muted' | 'grayscale'): void {
    if (!this._iconData) return;

    const { colors } = this._extractColorsFromSvg(this._iconData.svg);
    if (colors.length === 0) return;

    let newColors: string[];
    let variantName: string;

    switch (type) {
      case 'invert':
        newColors = colors.map(c => this._invertColor(this._toHexColor(c)));
        variantName = 'Inverted';
        break;
      case 'darken':
        newColors = colors.map(c => this._darkenColor(this._toHexColor(c), 0.3));
        variantName = 'Dark';
        break;
      case 'lighten':
        newColors = colors.map(c => this._lightenColor(this._toHexColor(c), 0.3));
        variantName = 'Light';
        break;
      case 'muted':
        newColors = colors.map(c => this._desaturateColor(this._toHexColor(c), 0.5));
        variantName = 'Muted';
        break;
      case 'grayscale':
        newColors = colors.map(c => this._desaturateColor(this._toHexColor(c), 1));
        variantName = 'Grayscale';
        break;
      default:
        return;
    }

    // Check if variant already exists and add number suffix
    const existingVariants = this._getSavedVariants(this._iconData.name);
    const existingNames = existingVariants.map(v => v.name);
    let finalName = variantName;
    let counter = 2;
    while (existingNames.includes(finalName)) {
      finalName = `${variantName} ${counter}`;
      counter++;
    }

    this._saveVariant(this._iconData.name, finalName, newColors);

    // Apply the new variant
    let newSvg = this._iconData.svg;
    for (let i = 0; i < colors.length; i++) {
      newSvg = this._replaceColorInSvg(newSvg, colors[i], newColors[i]);
    }
    this._iconData.svg = newSvg;
    this._selectedVariantIndex = this._getSavedVariants(this._iconData.name).length - 1;

    this._update();
    vscode.window.showInformationMessage(`Variant "${finalName}" generated`);
  }

  // Animation storage methods - use animations.js in output directory
  private _getAnimationsFilePath(): string | undefined {
    const outputDir = getSvgConfig<string>('outputDirectory', '');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || !outputDir) return undefined;

    const path = require('path');
    return path.join(workspaceFolders[0].uri.fsPath, outputDir, 'animations.js');
  }

  private _readAnimationsFromFile(): Record<string, { type: string; duration: number; timing: string; iteration: string; delay?: number; direction?: string }> {
    try {
      const filePath = this._getAnimationsFilePath();
      if (!filePath) return {};

      const fs = require('fs');
      if (!fs.existsSync(filePath)) return {};

      const content = fs.readFileSync(filePath, 'utf-8');
      const match = content.match(/export\s+const\s+animations\s*=\s*(\{[\s\S]*\});/);
      if (match) {
        return new Function(`return ${match[1]}`)();
      }
      return {};
    } catch {
      return {};
    }
  }

  private _writeAnimationsToFile(animations: Record<string, { type: string; duration: number; timing: string; iteration: string; delay?: number; direction?: string }>): void {
    try {
      const filePath = this._getAnimationsFilePath();
      if (!filePath) return;

      const fs = require('fs');
      const path = require('path');

      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let content = '// Auto-generated by Icon Manager\n';
      content += '// Animations for icons - defines default animation per icon\n';
      content += '// Use: <sg-icon name="icon-name" animation="spin"></sg-icon>\n\n';
      content += 'export const animations = {\n';

      const entries = Object.entries(animations);
      entries.forEach(([iconName, anim], idx) => {
        const delay = anim.delay || 0;
        const direction = anim.direction || 'normal';
        content += `  '${iconName}': { type: '${anim.type}', duration: ${anim.duration}, timing: '${anim.timing}', iteration: '${anim.iteration}', delay: ${delay}, direction: '${direction}' }`;
        content += idx < entries.length - 1 ? ',\n' : '\n';
      });

      content += '};\n';

      fs.writeFileSync(filePath, content);
    } catch (error) {
      console.error('Error writing animations:', error);
    }
  }

  private async _saveAnimation(iconName: string, type: string, settings: { duration: number; timing: string; iteration: string; delay?: number; direction?: string }): Promise<void> {
    const animations = this._readAnimationsFromFile();
    animations[iconName] = { type, ...settings };
    this._writeAnimationsToFile(animations);
  }

  private async _removeAnimation(iconName: string): Promise<void> {
    const animations = this._readAnimationsFromFile();
    if (animations[iconName]) {
      delete animations[iconName];
      this._writeAnimationsToFile(animations);
    }
  }

  private _getIconAnimation(iconName: string): { type: string; duration: number; timing: string; iteration: string; delay?: number; direction?: string } | undefined {
    const animations = this._readAnimationsFromFile();
    return animations[iconName];
  }

  private async _saveSvgToFile(svg: string): Promise<void> {
    if (!this._iconData?.location) {
      vscode.window.showWarningMessage('No source file location available');
      return;
    }

    const { file, line } = this._iconData.location;

    try {
      const uri = vscode.Uri.file(file);
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();

      if (file.endsWith('.svg')) {
        // Replace entire file content
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(text.length)
        );
        edit.replace(uri, fullRange, svg);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        vscode.window.showInformationMessage('SVG file saved');
      } else {
        // Find and replace inline SVG
        const lines = text.split('\n');
        let svgStart = -1;
        let svgEnd = -1;
        let depth = 0;

        for (let i = line - 1; i < lines.length && i >= 0; i++) {
          const lineText = lines[i];

          if (svgStart === -1 && lineText.includes('<svg')) {
            svgStart = i;
          }

          if (svgStart !== -1) {
            depth += (lineText.match(/<svg/g) || []).length;
            depth -= (lineText.match(/<\/svg>/g) || []).length;

            if (depth === 0 || lineText.includes('</svg>')) {
              svgEnd = i;
              break;
            }
          }
        }

        if (svgStart !== -1 && svgEnd !== -1) {
          const edit = new vscode.WorkspaceEdit();
          const startPos = new vscode.Position(svgStart, lines[svgStart].indexOf('<svg'));
          const endLine = lines[svgEnd];
          const endPos = new vscode.Position(svgEnd, endLine.indexOf('</svg>') + 6);

          edit.replace(uri, new vscode.Range(startPos, endPos), svg);
          await vscode.workspace.applyEdit(edit);
          await document.save();
          vscode.window.showInformationMessage('SVG saved in source file');
        }
      }

      // Also update the built icons.js file if it exists
      await this._updateBuiltIconsFile(svg);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save: ${error}`);
    }
  }

  private async _updateBuiltIconsFile(svg: string): Promise<boolean> {
    if (!this._iconData?.name) {
      return false;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    // Get output directory from config
    const outputDir = getSvgConfig<string>('outputDirectory', '');

    // Look for icons.js in configured output and common locations
    const possiblePaths = outputDir
      ? [`${outputDir}/icons.js`, 'svg/icons.js', 'icons.js']
      : ['svg/icons.js', 'dist/icons.js', 'build/icons.js', 'public/icons.js', 'src/icons.js', 'icons.js'];

    for (const folder of workspaceFolders) {
      for (const relativePath of possiblePaths) {
        const iconsUri = vscode.Uri.joinPath(folder.uri, relativePath);

        try {
          const document = await vscode.workspace.openTextDocument(iconsUri);
          const text = document.getText();

          // Convert icon name to variable name format (matching extension.ts)
          const varName = this._toVariableName(this._iconData.name);

          // Extract body from SVG (remove <svg> wrapper)
          const bodyMatch = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
          const body = bodyMatch ? bodyMatch[1].trim() : svg;

          // Find the icon export and replace the body content
          // Pattern: export const varName = { ... body: `...`, ... }
          const iconStartPattern = new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*\\{`);
          const match = iconStartPattern.exec(text);

          if (match) {
            const startIdx = match.index;
            // Find the body: ` part
            const afterStart = text.substring(startIdx);
            const bodyStartMatch = afterStart.match(/body:\s*`/);

            if (bodyStartMatch && bodyStartMatch.index !== undefined) {
              const bodyContentStart = startIdx + bodyStartMatch.index + bodyStartMatch[0].length;

              // Find closing backtick (handle escaped backticks)
              let bodyContentEnd = bodyContentStart;
              let i = bodyContentStart;
              while (i < text.length) {
                if (text[i] === '\\' && text[i + 1] === '`') {
                  i += 2; // Skip escaped backtick
                } else if (text[i] === '`') {
                  bodyContentEnd = i;
                  break;
                } else {
                  i++;
                }
              }

              if (bodyContentEnd > bodyContentStart) {
                // Escape backticks and dollar signs in body
                const escapedBody = body.replace(/`/g, '\\`').replace(/\$/g, '\\$');

                const newText = text.substring(0, bodyContentStart) + escapedBody + text.substring(bodyContentEnd);

                const edit = new vscode.WorkspaceEdit();
                const fullRange = new vscode.Range(
                  document.positionAt(0),
                  document.positionAt(text.length)
                );
                edit.replace(iconsUri, fullRange, newText);
                await vscode.workspace.applyEdit(edit);
                await document.save();

                vscode.window.showInformationMessage(`Updated ${relativePath}`);
                return true;
              }
            }
          }
        } catch {
          // File doesn't exist at this path, continue searching
          continue;
        }
      }
    }
    return false;
  }

  private _toVariableName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .split('-')
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join('');
  }

  private _extractColorsFromSvg(svg: string): { colors: string[], hasCurrentColor: boolean } {
    const colorRegex = /(fill|stroke|stop-color)=["']([^"']+)["']/gi;
    const styleColorRegex = /(fill|stroke|stop-color)\s*:\s*([^;"'\s]+)/gi;
    const colorsSet = new Set<string>();
    let hasCurrentColor = false;

    let colorMatch;
    while ((colorMatch = colorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        hasCurrentColor = true;
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    while ((colorMatch = styleColorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        hasCurrentColor = true;
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }

    return { colors: Array.from(colorsSet), hasCurrentColor };
  }

  private _replaceColorInSvg(svg: string, oldColor: string, newColor: string): string {
    const normalizeColor = (color: string): string => {
      color = color.toLowerCase().trim();
      if (/^#[0-9a-f]{3}$/i.test(color)) {
        color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    };

    const oldNorm = normalizeColor(oldColor);
    const newNorm = normalizeColor(newColor);

    let result = svg;

    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)=["']${oldNorm}["']`, 'gi'),
      `$1="${newNorm}"`
    );

    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)=["']${oldColor}["']`, 'gi'),
      `$1="${newNorm}"`
    );

    result = result.replace(
      new RegExp(`(fill|stroke|stop-color)\\s*:\\s*${oldNorm}`, 'gi'),
      `$1: ${newNorm}`
    );

    return result;
  }

  public dispose() {
    IconEditorPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) x.dispose();
    }
  }

  private _update() {
    if (this._iconData) {
      this._panel.title = `Edit: ${this._iconData.name}`;
    }
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private _highlightSvgCode(svg: string): string {
    // First format the SVG (before escaping)
    const formatted = this._formatSvgPretty(svg);
    // Filter out empty lines
    const lines = formatted.split('\n').filter(line => line.trim() !== '');

    // Track if we're inside a style tag for CSS highlighting
    let insideStyle = false;

    // Generate highlighted code rows
    const codeRows = lines.map((line, i) => {
      // Check if entering/exiting style
      if (line.includes('<style')) insideStyle = true;
      const wasInsideStyle = insideStyle;
      if (line.includes('</style')) insideStyle = false;

      // Apply syntax highlighting before escaping
      let highlighted = line;

      // Replace special chars that would be escaped, using placeholders
      highlighted = highlighted
        .replace(/&/g, '⟨AMP⟩')
        .replace(/</g, '⟨LT⟩')
        .replace(/>/g, '⟨GT⟩');

      // If this is CSS content (not the style tag itself)
      if (wasInsideStyle && !line.trim().startsWith('<')) {
        // CSS highlighting
        // Highlight @keyframes and @media
        highlighted = highlighted.replace(/@([\w-]+)/g, '⦃k⦄@$1⦃/k⦄');
        // Highlight selectors (before {)
        highlighted = highlighted.replace(/^(\s*)([\w\s.#:-]+)(\s*\{)/g, '$1⦃sel⦄$2⦃/sel⦄$3');
        // Highlight property names
        highlighted = highlighted.replace(/([\w-]+)(\s*:)/g, '⦃a⦄$1⦃/a⦄$2');
        // Highlight property values (after : until ;)
        highlighted = highlighted.replace(/:\s*([^;{}]+)(;?)/g, ': ⦃v⦄$1⦃/v⦄$2');
        // Highlight braces
        highlighted = highlighted.replace(/([{}])/g, '⦃br⦄$1⦃/br⦄');
      } else {
        // SVG/XML highlighting
        // Highlight comments
        highlighted = highlighted.replace(/(⟨LT⟩!--.*?--⟨GT⟩)/g, '⦃c⦄$1⦃/c⦄');

        // Highlight tag names (opening and closing)
        highlighted = highlighted.replace(/(⟨LT⟩\/?)([\w:-]+)/g, '⦃b⦄$1⦃/b⦄⦃t⦄$2⦃/t⦄');

        // Highlight closing brackets
        highlighted = highlighted.replace(/(\/?⟨GT⟩)/g, '⦃b⦄$1⦃/b⦄');

        // Highlight attribute names  
        highlighted = highlighted.replace(/\s([\w:-]+)(=)/g, ' ⦃a⦄$1⦃/a⦄$2');

        // Highlight attribute values (strings in quotes)
        highlighted = highlighted.replace(/"([^"]*)"/g, '⦃s⦄"$1"⦃/s⦄');
      }

      // Now convert placeholders to actual HTML
      highlighted = highlighted
        .replace(/⟨AMP⟩/g, '&amp;')
        .replace(/⟨LT⟩/g, '&lt;')
        .replace(/⟨GT⟩/g, '&gt;')
        .replace(/⦃b⦄/g, '<b>')
        .replace(/⦃\/b⦄/g, '</b>')
        .replace(/⦃t⦄/g, '<i>')
        .replace(/⦃\/t⦄/g, '</i>')
        .replace(/⦃a⦄/g, '<u>')
        .replace(/⦃\/a⦄/g, '</u>')
        .replace(/⦃s⦄/g, '<em>')
        .replace(/⦃\/s⦄/g, '</em>')
        .replace(/⦃c⦄/g, '<cite>')
        .replace(/⦃\/c⦄/g, '</cite>')
        // CSS specific
        .replace(/⦃k⦄/g, '<kbd>')
        .replace(/⦃\/k⦄/g, '</kbd>')
        .replace(/⦃sel⦄/g, '<var>')
        .replace(/⦃\/sel⦄/g, '</var>')
        .replace(/⦃v⦄/g, '<samp>')
        .replace(/⦃\/v⦄/g, '</samp>')
        .replace(/⦃br⦄/g, '<s>')
        .replace(/⦃\/br⦄/g, '</s>');

      return `<div class="code-row"><div class="ln">${i + 1}</div><div class="cl">${highlighted}</div></div>`;
    }).join('');

    return `<div class="code-editor">${codeRows}</div>`;
  }

  private _formatSvgPretty(svg: string): string {
    if (!svg) return '';

    let result = svg.trim()
      .replace(/\s*style="[^"]*animation[^"]*"/gi, '') // Limpia estilos de preview
      .replace(/\s+/g, ' ')                            // Normaliza
      .replace(/>\s*</g, '>\n<');                      // Forzar líneas por tag

    const lines = result.split('\n');
    const formatted: string[] = [];
    let indent = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('</')) indent = Math.max(0, indent - 1);

      formatted.push('  '.repeat(indent) + trimmed);

      // Regla de indentación: Abrir tag, que no sea auto-conclusivo ni de una sola línea
      const isOpening = trimmed.startsWith('<') && !trimmed.startsWith('</') && !trimmed.startsWith('<!') && !trimmed.startsWith('<?');
      const isSingleLine = trimmed.endsWith('/>') || (trimmed.includes('<') && trimmed.includes('</'));

      if (isOpening && !isSingleLine) {
        indent++;
      }
    }

    let finalResult = formatted.join('\n');

    // Formatear el CSS interno de las etiquetas <style>
    finalResult = finalResult.replace(/<style>([\s\S]*?)<\/style>/gi, (match, cssContent) => {
      return `<style>\n${this._formatCss(cssContent)}</style>`;
    });

    return finalResult;
  }
  public highlightCode(svg: string): string {
    const formatted = this._formatSvgPretty(svg);
    const lines = formatted.split('\n').filter(line => line.trim() !== '');

    const lineNumbers = lines.map((_, i) => `<span class="ln">${i + 1}</span>`).join('');
    let insideStyle = false;

    const codeLines = lines.map(line => {
      // Detectar si entramos en bloque de CSS
      if (line.includes('<style')) insideStyle = true;
      const wasInsideStyle = insideStyle;
      if (line.includes('</style')) insideStyle = false;

      // 1. Escapado preventivo con marcadores
      let highlighted = line
        .replace(/&/g, '⟨AMP⟩')
        .replace(/</g, '⟨LT⟩')
        .replace(/>/g, '⟨GT⟩');

      if (wasInsideStyle && !line.trim().startsWith('<')) {
        // --- RESALTADO CSS ---
        highlighted = highlighted
          .replace(/(@[\w-]+)/g, '⦃k⦄$1⦃/k⦄') // Keyframes/Media
          .replace(/^(\s*)([^{]+)(\s*\{)/g, '$1⦃sel⦄$2⦃/sel⦄$3') // Selectores
          .replace(/([\w-]+)(\s*:)/g, '⦃a⦄$1⦃/a⦄$2') // Propiedades
          .replace(/(:\s*)([^;{}]+)/g, '$1⦃v⦄$2⦃/v⦄') // Valores
          .replace(/([{}])/g, '⦃br⦄$1⦃/br⦄'); // Llaves
      } else {
        // --- RESALTADO SVG ---
        highlighted = highlighted
          .replace(/(⟨LT⟩!--.*?--⟨GT⟩)/g, '⦃c⦄$1⦃/c⦄') // Comentarios
          .replace(/(⟨LT⟩\/?)([\w:-]+)/g, '⦃b⦄$1⦃/b⦄⦃t⦄$2⦃/t⦄') // Tags
          .replace(/(\/?⟨GT⟩)/g, '⦃b⦄$1⦃/b⦄') // Brackets
          .replace(/\s([\w:-]+)(?==)/g, ' ⦃a⦄$1⦃/a⦄') // Atributos
          .replace(/"([^"]*)"/g, '⦃s⦄"$1"⦃/s⦄'); // Valores string
      }

      // 2. Inyección de HTML final
      return `<span class="cl">${this._placeholdersToHtml(highlighted)}</span>`;
    }).join('\n');

    return `<div class="code-editor"><div class="line-numbers">${lineNumbers}</div><pre class="code-block"><code>${codeLines}</code></pre></div>`;
  }

  private _placeholdersToHtml(text: string): string {
    return text
      .replace(/⟨AMP⟩/g, '&amp;').replace(/⟨LT⟩/g, '&lt;').replace(/⟨GT⟩/g, '&gt;')
      .replace(/⦃b⦄/g, '<b>').replace(/⦃\/b⦄/g, '</b>') // Brackets
      .replace(/⦃t⦄/g, '<i>').replace(/⦃\/t⦄/g, '</i>') // Tags
      .replace(/⦃a⦄/g, '<u>').replace(/⦃\/a⦄/g, '</u>') // Attributes/Props
      .replace(/⦃s⦄/g, '<em>').replace(/⦃\/s⦄/g, '</em>') // Strings
      .replace(/⦃c⦄/g, '<cite>').replace(/⦃\/c⦄/g, '</cite>') // Comments
      .replace(/⦃k⦄/g, '<kbd>').replace(/⦃\/k⦄/g, '</kbd>') // CSS Keywords
      .replace(/⦃sel⦄/g, '<var>').replace(/⦃\/sel⦄/g, '</var>') // Selectors
      .replace(/⦃v⦄/g, '<samp>').replace(/⦃\/v⦄/g, '</samp>') // CSS Values
      .replace(/⦃br⦄/g, '<s>').replace(/⦃\/br⦄/g, '</s>'); // Braces
  }

  private _formatCss(css: string): string {
    if (!css) return '';

    // Limpieza: colapsa espacios y fuerza saltos de línea estratégicos
    const cleanCss = css
      .replace(/\s+/g, ' ')
      .replace(/\s*\{\s*/g, ' {\n')
      .replace(/\s*\}\s*/g, '\n}\n')
      .replace(/;\s*/g, ';\n')
      .trim();

    const lines = cleanCss.split('\n');
    const formatted: string[] = [];
    let indentLevel = 1; // Base 1 porque vive dentro de <style>

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // Si la línea cierra bloque, reduce indentación antes de añadirla
      if (line.startsWith('}')) {
        indentLevel = Math.max(1, indentLevel - 1);
      }

      formatted.push('  '.repeat(indentLevel) + line);

      // Si la línea abre bloque, aumenta para la siguiente
      if (line.endsWith('{')) {
        indentLevel++;
      }
    }

    // El espacio final ayuda a alinear el cierre de </style>
    return formatted.join('\n') + '\n  ';
  }

  private _toHexColor(color: string): string {
    if (color.startsWith('#')) {
      if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    }

    const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return '#' + r + g + b;
    }

    const namedColors: Record<string, string> = {
      'black': '#000000', 'white': '#ffffff', 'red': '#ff0000',
      'green': '#008000', 'blue': '#0000ff', 'yellow': '#ffff00',
      'cyan': '#00ffff', 'magenta': '#ff00ff', 'gray': '#808080',
      'grey': '#808080', 'orange': '#ffa500', 'purple': '#800080',
      'currentcolor': '#000000'
    };

    return namedColors[color.toLowerCase()] || '#000000';
  }

  private _ensureSvgNamespace(svg: string): string {
    // Robust check for namespace (single or double quotes)
    const nsPattern = /xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/gi;
    const matches = svg.match(nsPattern);
    
    // If multiple namespaces found (corruption), remove all and add one back
    if (matches && matches.length > 1) {
      svg = svg.replace(nsPattern, '');
      return svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    } 
    
    // If no namespace found, add it
    if (!matches || matches.length === 0) {
      return svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    
    return svg;
  }

  private _cleanAnimationFromSvg(svg: string): string {
    // Remove styles with our specific ID
    svg = svg.replace(/<style id="icon-manager-animation">[\s\S]*?<\/style>/gi, '');
    // Remove scripts with our specific ID
    svg = svg.replace(/<script id="icon-manager-script">[\s\S]*?<\/script>/gi, '');
    
    // Legacy cleanup: Remove styles that look like ours (containing keyframes and svg animation)
    svg = svg.replace(/<style>@keyframes[\s\S]*?svg\s*\{\s*animation:[\s\S]*?\}[\s\S]*?<\/style>/gi, '');
    
    // Legacy cleanup for draw animations (script tag)
    svg = svg.replace(/<script>\s*\(function\(\)\s*\{\s*var svg = document\.currentScript\.parentElement;[\s\S]*?\}\)\(\);\s*<\/script>/gi, '');

    return svg;
  }

  private _embedAnimationInSvg(
    svg: string,
    animation: string,
    settings: { duration: number; timing: string; iteration: string; direction?: string; delay?: number }
  ): string {
    // Clean up previous animations first
    svg = this._cleanAnimationFromSvg(svg);
    svg = this._ensureSvgNamespace(svg);

    // Handle draw animation specially - it needs path length calculation
    if (animation === 'draw') {
      return this._embedDrawAnimation(svg, settings);
    }
    if (animation === 'draw-reverse') {
      return this._embedDrawAnimation(svg, settings, true);
    }
    if (animation === 'draw-loop') {
      return this._embedDrawLoopAnimation(svg, settings);
    }

    const keyframes: Record<string, string> = {
      spin: `@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`,
      'spin-reverse': `@keyframes spin-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }`,
      pulse: `@keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.8; } }`,
      'pulse-grow': `@keyframes pulse-grow { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }`,
      bounce: `@keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }`,
      'bounce-horizontal': `@keyframes bounce-horizontal { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(8px); } }`,
      shake: `@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }`,
      'shake-vertical': `@keyframes shake-vertical { 0%, 100% { transform: translateY(0); } 25% { transform: translateY(-4px); } 75% { transform: translateY(4px); } }`,
      fade: `@keyframes fade { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`,
      'fade-in': `@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }`,
      'fade-out': `@keyframes fade-out { from { opacity: 1; } to { opacity: 0; } }`,
      float: `@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }`,
      swing: `@keyframes swing { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(15deg); } 75% { transform: rotate(-15deg); } }`,
      flip: `@keyframes flip { 0% { transform: perspective(400px) rotateY(0); } 100% { transform: perspective(400px) rotateY(360deg); } }`,
      'flip-x': `@keyframes flip-x { 0% { transform: perspective(400px) rotateX(0); } 100% { transform: perspective(400px) rotateX(360deg); } }`,
      heartbeat: `@keyframes heartbeat { 0%, 100% { transform: scale(1); } 14% { transform: scale(1.15); } 28% { transform: scale(1); } 42% { transform: scale(1.15); } 70% { transform: scale(1); } }`,
      wobble: `@keyframes wobble { 0%, 100% { transform: translateX(0) rotate(0); } 15% { transform: translateX(-6px) rotate(-5deg); } 30% { transform: translateX(5px) rotate(3deg); } 45% { transform: translateX(-4px) rotate(-3deg); } 60% { transform: translateX(3px) rotate(2deg); } 75% { transform: translateX(-2px) rotate(-1deg); } }`,
      'rubber-band': `@keyframes rubber-band { 0%, 100% { transform: scaleX(1); } 30% { transform: scaleX(1.25) scaleY(0.75); } 40% { transform: scaleX(0.75) scaleY(1.25); } 50% { transform: scaleX(1.15) scaleY(0.85); } 65% { transform: scaleX(0.95) scaleY(1.05); } 75% { transform: scaleX(1.05) scaleY(0.95); } }`,
      jello: `@keyframes jello { 0%, 11.1%, 100% { transform: skewX(0) skewY(0); } 22.2% { transform: skewX(-12.5deg) skewY(-12.5deg); } 33.3% { transform: skewX(6.25deg) skewY(6.25deg); } 44.4% { transform: skewX(-3.125deg) skewY(-3.125deg); } 55.5% { transform: skewX(1.5625deg) skewY(1.5625deg); } 66.6% { transform: skewX(-0.78125deg) skewY(-0.78125deg); } 77.7% { transform: skewX(0.390625deg) skewY(0.390625deg); } 88.8% { transform: skewX(-0.1953125deg) skewY(-0.1953125deg); } }`,
      tada: `@keyframes tada { 0%, 100% { transform: scale(1) rotate(0); } 10%, 20% { transform: scale(0.9) rotate(-3deg); } 30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); } 40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); } }`,
      'zoom-in': `@keyframes zoom-in { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }`,
      'zoom-out': `@keyframes zoom-out { from { transform: scale(1); opacity: 1; } to { transform: scale(0); opacity: 0; } }`,
      'slide-in-up': `@keyframes slide-in-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`,
      'slide-in-down': `@keyframes slide-in-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`,
      'slide-in-left': `@keyframes slide-in-left { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`,
      'slide-in-right': `@keyframes slide-in-right { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`,
      morph: `@keyframes morph { 0%, 100% { border-radius: 0; } 50% { border-radius: 50%; } }`,
      blink: `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`,
      glow: `@keyframes glow { 0%, 100% { filter: drop-shadow(0 0 2px currentColor); } 50% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 0 20px currentColor); } }`
    };

    const keyframe = keyframes[animation];
    if (!keyframe) return svg;

    const duration = settings.duration || 1;
    const timing = settings.timing || 'ease';
    const iteration = settings.iteration || 'infinite';
    const direction = settings.direction || 'normal';
    const delay = settings.delay || 0;

    const delayStr = delay > 0 ? ` ${delay}s` : '';
    const cssStyle = `<style id="icon-manager-animation">${keyframe} svg { animation: ${animation} ${duration}s ${timing}${delayStr} ${iteration} ${direction}; transform-origin: center center; }</style>`;

    // Insert style after the opening <svg> tag
    const svgTagMatch = svg.match(/<svg[^>]*>/i);
    if (svgTagMatch) {
      const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
      return svg.slice(0, insertPos) + cssStyle + svg.slice(insertPos);
    }

    return svg;
  }

  // Special animation: Draw paths as if being drawn
  private _embedDrawAnimation(
    svg: string,
    settings: { duration: number; timing: string; iteration: string; delay?: number },
    reverse: boolean = false
  ): string {
    const duration = settings.duration || 2;
    const timing = settings.timing || 'ease-in-out';
    const delay = settings.delay || 0;

    // Create CSS for stroke animation on all path/line/polyline/polygon/circle/ellipse/rect elements
    const animName = reverse ? 'undraw' : 'draw';
    const drawKeyframes = reverse
      ? `@keyframes undraw { from { stroke-dashoffset: 0; } to { stroke-dashoffset: var(--path-length); } }`
      : `@keyframes draw { from { stroke-dashoffset: var(--path-length); } to { stroke-dashoffset: 0; } }`;

    const fillKeyframes = reverse
      ? `@keyframes fill-out { 0%, 80% { fill-opacity: 1; } 100% { fill-opacity: 0; } }`
      : `@keyframes fill-in { 0%, 80% { fill-opacity: 0; } 100% { fill-opacity: 1; } }`;

    const fillAnimName = reverse ? 'fill-out' : 'fill-in';

    const delayStr = delay > 0 ? ` ${delay}s` : '';
    const cssStyle = `<style id="icon-manager-animation">
      ${drawKeyframes}
      ${fillKeyframes}
      svg path, svg line, svg polyline, svg polygon, svg circle, svg ellipse, svg rect {
        stroke-dasharray: var(--path-length, 100);
        stroke-dashoffset: ${reverse ? '0' : 'var(--path-length, 100)'};
        animation: ${animName} ${duration}s ${timing}${delayStr} forwards;
        fill-opacity: ${reverse ? '1' : '0'};
      }
      svg path[fill], svg circle[fill], svg ellipse[fill], svg rect[fill], svg polygon[fill] {
        animation: ${animName} ${duration}s ${timing}${delayStr} forwards, ${fillAnimName} ${duration * 1.2}s ${timing}${delayStr} forwards;
      }
    </style>
    <script id="icon-manager-script">
      (function() {
        var svg = document.currentScript.parentElement;
        var elements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
        elements.forEach(function(el) {
          try {
            var len = el.getTotalLength ? el.getTotalLength() : 100;
            el.style.setProperty('--path-length', len);
          } catch(e) { el.style.setProperty('--path-length', '100'); }
        });
      })();
    </script>`;

    // Insert style after the opening <svg> tag
    const svgTagMatch = svg.match(/<svg[^>]*>/i);
    if (svgTagMatch) {
      const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
      return svg.slice(0, insertPos) + cssStyle + svg.slice(insertPos);
    }

    return svg;
  }

  // Special animation: Draw loop (draw then undraw)
  private _embedDrawLoopAnimation(
    svg: string,
    settings: { duration: number; timing: string; iteration: string; delay?: number }
  ): string {
    const duration = settings.duration || 2;
    const timing = settings.timing || 'ease-in-out';
    const iteration = settings.iteration || 'infinite';
    const delay = settings.delay || 0;

    const drawKeyframes = `@keyframes draw-loop {
      0% { stroke-dashoffset: var(--path-length, 100); fill-opacity: 0; }
      45% { stroke-dashoffset: 0; fill-opacity: 1; }
      55% { stroke-dashoffset: 0; fill-opacity: 1; }
      100% { stroke-dashoffset: var(--path-length, 100); fill-opacity: 0; }
    }`;

    const delayStr = delay > 0 ? ` ${delay}s` : '';
    const cssStyle = `<style id="icon-manager-animation">
      ${drawKeyframes}
      svg path, svg line, svg polyline, svg polygon, svg circle, svg ellipse, svg rect {
        stroke-dasharray: var(--path-length, 100);
        stroke-dashoffset: var(--path-length, 100);
        fill-opacity: 0;
        animation: draw-loop ${duration}s ${timing}${delayStr} ${iteration};
      }
    </style>
    <script id="icon-manager-script">
      (function() {
        var svg = document.currentScript.parentElement;
        var elements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
        elements.forEach(function(el) {
          try {
            var len = el.getTotalLength ? el.getTotalLength() : 100;
            el.style.setProperty('--path-length', len);
          } catch(e) { el.style.setProperty('--path-length', '100'); }
        });
      })();
    </script>`;

    // Insert style after the opening <svg> tag
    const svgTagMatch = svg.match(/<svg[^>]*>/i);
    if (svgTagMatch) {
      const insertPos = svgTagMatch.index! + svgTagMatch[0].length;
      return svg.slice(0, insertPos) + cssStyle + svg.slice(insertPos);
    }

    return svg;
  }

  private _detectAnimationFromSvg(svg: string): { type: string; settings: any } | null {
    // Check for draw animations first (they are special)
    if (svg.includes('@keyframes draw-loop')) {
       return { type: 'draw-loop', settings: { duration: 2, timing: 'ease-in-out', iteration: 'infinite', delay: 0, direction: 'normal' } };
    }
    if (svg.includes('@keyframes draw-reverse') || svg.includes('@keyframes undraw')) {
       return { type: 'draw-reverse', settings: { duration: 2, timing: 'ease-in-out', iteration: '1', delay: 0, direction: 'normal' } };
    }
    if (svg.includes('@keyframes draw')) {
       return { type: 'draw', settings: { duration: 2, timing: 'ease-in-out', iteration: '1', delay: 0, direction: 'normal' } };
    }

    // Check for standard animations
    // Try to find animation name first
    const nameMatch = svg.match(/animation:\s*([\w-]+)/);
    if (!nameMatch) return null;
    
    const type = nameMatch[1];
    
    // Try to parse full settings: name duration timing [delay] iteration direction
    const fullMatch = svg.match(/animation:\s*([\w-]+)\s+([\d.]+)s\s+([^\s]+)(?:\s+([\d.]+)s)?\s+([^\s]+)\s+([^\s;}]+)/);
    
    if (fullMatch && fullMatch[1] === type) {
      return {
        type: type,
        settings: {
          duration: parseFloat(fullMatch[2]),
          timing: fullMatch[3],
          delay: fullMatch[4] ? parseFloat(fullMatch[4]) : 0,
          iteration: fullMatch[5],
          direction: fullMatch[6]
        }
      };
    }
    
    // Fallback: try to find duration at least, use defaults for others
    const durationMatch = svg.match(/animation:.*?([\d.]+)s/);
    
    return {
      type: type,
      settings: {
        duration: durationMatch ? parseFloat(durationMatch[1]) : 1,
        timing: 'ease',
        delay: 0,
        iteration: 'infinite',
        direction: 'normal'
      }
    };
  }

  private _getHtmlForWebview(): string {
    if (!this._iconData) {
      return '<html><body><p>No icon selected</p></body></html>';
    }

    const { name, svg, location } = this._iconData;
    const defaultVariant = this._getDefaultVariant(name);
    const savedAnimation = this._getIconAnimation(name);
    
    // Detect embedded animation in SVG
    let detectedAnimation = this._detectAnimationFromSvg(svg);
    // If no embedded animation, check the external config
    if (!detectedAnimation && savedAnimation) {
        detectedAnimation = { type: savedAnimation.type, settings: savedAnimation };
    }

    // Extract colors from SVG
    const colorRegex = /(fill|stroke|stop-color)=["']([^"']+)["']/gi;
    const styleColorRegex = /(fill|stroke|stop-color)\s*:\s*([^;"'\s]+)/gi;
    const colorsSet = new Set<string>();
    const specialColors = new Set<string>();

    let colorMatch;
    while ((colorMatch = colorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        specialColors.add('currentColor');
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    while ((colorMatch = styleColorRegex.exec(svg)) !== null) {
      const color = colorMatch[2].toLowerCase();
      if (color === 'currentcolor') {
        specialColors.add('currentColor');
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    const svgColors = Array.from(colorsSet);
    const hasCurrentColor = specialColors.has('currentColor');

    let displaySvg = svg;
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }

    const fileSize = new Blob([svg]).size;
    const fileSizeStr = fileSize < 1024 ? `${fileSize} B` : `${(fileSize / 1024).toFixed(1)} KB`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/@vscode/codicons/dist/codicon.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    :root {
      --font-mono: var(--vscode-editor-font-family, 'Consolas', monospace);
    }
    
    body {
      font-family: var(--vscode-font-family);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      height: 100vh;
      overflow: hidden;
    }
    
    .container {
      max-width: 900px;
      margin: 0 auto;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: linear-gradient(135deg, var(--vscode-sideBar-background), transparent);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      margin-bottom: 12px;
      flex-shrink: 0;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .icon-name {
      font-size: 16px;
      font-weight: 700;
      font-family: var(--font-mono);
    }
    
    .rename-btn {
      background: transparent;
      border: 1px solid transparent;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }
    
    .rename-btn:hover {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-foreground);
      border-color: var(--vscode-panel-border);
    }
    
    .badge {
      font-size: 9px;
      padding: 3px 8px;
      border-radius: 10px;
      font-weight: 600;
      text-transform: uppercase;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .file-size {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-family: var(--font-mono);
    }
    
    /* Main Layout - Two Columns */
    .main-content {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      flex: 1;
      min-height: 0;
    }
    
    /* Left Column - Preview */
    .left-column {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    
    .preview-code-container {
      display: flex;
      gap: 12px;
      width: 100%;
      justify-content: center;
      align-items: flex-start;
    }
    
    .preview-code-container.split-view {
      justify-content: center;
    }
    
    .preview-code-container.split-view .preview-section {
      flex: 0 0 auto;
    }
    
    .preview-section {
      display: flex;
      justify-content: center;
      flex-shrink: 0;
    }
    
    /* Code Tab Styles */
    .code-tab-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: #1e1e1e;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
    }
    
    .code-tab-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    
    .code-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: rgba(255,255,255,0.5);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .code-title .codicon {
      font-size: 14px;
      color: #4fc1ff;
    }
    
    .code-header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .code-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 4px;
      background: rgba(79, 193, 255, 0.1);
      border: 1px solid rgba(79, 193, 255, 0.2);
      transition: all 0.15s;
    }
    
    .code-toggle:hover {
      background: rgba(79, 193, 255, 0.15);
    }
    
    .code-toggle input {
      display: none;
    }
    
    .code-toggle .toggle-label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: rgba(79, 193, 255, 0.7);
    }
    
    .code-toggle input:checked + .toggle-label {
      color: #4fc1ff;
    }
    
    .code-toggle input:checked + .toggle-label .codicon {
      color: #4fc1ff;
    }
    
    .code-actions {
      display: flex;
      gap: 4px;
    }
    
    .code-action-btn {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      color: rgba(255,255,255,0.6);
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      transition: all 0.15s;
    }
    
    .code-action-btn:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-color: rgba(255,255,255,0.15);
    }
    
    .code-action-btn .codicon {
      font-size: 14px;
    }
    
    .code-content {
      flex: 1;
      overflow: auto;
      background: #1a1a1a;
    }
    
    .code-editor {
      display: flex;
      flex-direction: column;
      min-height: 100%;
      font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
      font-size: 12px;
      line-height: 1.65;
      padding: 14px 0;
    }
    
    .code-row {
      display: flex;
      width: 100%;
    }
    
    .code-row:hover {
      background: rgba(255,255,255,0.03);
    }
    
    .ln {
      flex-shrink: 0;
      min-width: 45px;
      padding-right: 12px;
      text-align: right;
      color: rgba(255,255,255,0.25);
      user-select: none;
      border-right: 1px solid rgba(255,255,255,0.05);
    }
    
    .cl {
      flex: 1;
      padding-left: 16px;
      padding-right: 16px;
      white-space: pre-wrap;
      word-break: break-word;
      color: #d4d4d4;
      tab-size: 2;
    }
    
    /* Syntax highlighting - using semantic HTML elements */
    .cl b { color: #808080; font-weight: normal; } /* brackets < > */
    .cl i { color: #4ec9b0; font-style: normal; font-weight: 500; } /* tag names */
    .cl u { color: #9cdcfe; text-decoration: none; } /* attributes / CSS properties */
    .cl em { color: #ce9178; font-style: normal; } /* strings */
    .cl cite { color: #6a9955; font-style: italic; } /* comments */
    
    /* CSS specific highlighting */
    .cl kbd { color: #c586c0; font-family: inherit; } /* @keyframes, @media */
    .cl var { color: #dcdcaa; font-style: normal; } /* CSS selectors */
    .cl samp { color: #ce9178; } /* CSS values */
    .cl s { color: #ffd700; text-decoration: none; font-weight: bold; } /* braces { } */
    
    .preview-box {
      --checker-size: 10px;
      --checker-color: rgba(128, 128, 128, 0.08);
      width: 200px;
      height: 200px;
      background-color: var(--vscode-editor-background);
      background-image: 
        linear-gradient(45deg, var(--checker-color) 25%, transparent 25%),
        linear-gradient(-45deg, var(--checker-color) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--checker-color) 75%),
        linear-gradient(-45deg, transparent 75%, var(--checker-color) 75%);
      background-size: calc(var(--checker-size) * 2) calc(var(--checker-size) * 2);
      background-position: 0 0, 0 var(--checker-size), var(--checker-size) calc(var(--checker-size) * -1), calc(var(--checker-size) * -1) 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    
    .preview-box svg {
      width: 150px;
      height: 150px;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    
    /* Zoom Controls */
    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
    }
    
    .zoom-btn {
      width: 26px;
      height: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .zoom-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: scale(1.1);
    }
    
    .zoom-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .zoom-level {
      min-width: 50px;
      text-align: center;
      font-size: 12px;
      font-family: var(--font-mono);
      font-weight: 600;
    }
    
    .zoom-separator {
      width: 1px;
      height: 18px;
      background: var(--vscode-panel-border);
      margin: 0 2px;
    }
    
    .restart-anim-btn {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .restart-anim-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    /* Section Card */
    .section {
      background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
    }
    
    .section-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .section-title .codicon {
      font-size: 12px;
      opacity: 0.8;
    }
    
    /* Right Column */
    .right-column {
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: hidden;
    }
    
    /* Tabs */
    .tabs-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      overflow: hidden;
    }
    
    .tabs-header {
      display: flex;
      gap: 0;
      background: var(--vscode-editor-background);
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 0;
    }
    
    .tab-btn {
      flex: 1;
      padding: 10px 16px;
      background: transparent;
      border: none;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    
    .tab-btn:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-list-hoverBackground);
    }
    
    .tab-btn.active {
      color: var(--vscode-button-background);
      border-bottom-color: var(--vscode-button-background);
      background: var(--vscode-sideBar-background);
    }
    
    .tab-btn .codicon {
      font-size: 14px;
    }
    
    .tab-content {
      display: none;
      padding: 12px;
      flex: 1;
      overflow-y: auto;
    }
    
    .tab-content.active {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    #tab-code.active {
      padding: 0;
      gap: 0;
      min-height: 0;
      overflow: hidden;
    }
    
    /* Colors & Variants Row */
    .colors-Variants-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    
    /* Color Swatches */
    .color-swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    
    .color-swatch {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 2px solid rgba(255,255,255,0.1);
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }
    
    .color-swatch:hover {
      transform: scale(1.15);
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    
    .color-swatch input[type="color"] {
      position: absolute;
      width: 100%;
      height: 100%;
      opacity: 0;
      cursor: pointer;
    }
    
    /* Variants Section */
    .disabled-section {
      opacity: 0.6;
    }
    
    .Variants-disabled-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: var(--vscode-input-background);
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    
    .Variants-disabled-message .codicon {
      font-size: 14px;
      opacity: 0.7;
    }
    
    .Variants-container {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    
    .variant-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .variant-item:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground);
    }
    
    .variant-item.default {
      border-style: solid;
      background: var(--vscode-input-background);
    }
    
    .variant-item.default .variant-name {
      font-style: normal;
    }
    
    .variant-item.selected {
      border-color: var(--vscode-button-background);
      background: rgba(0, 122, 204, 0.15);
      box-shadow: 0 0 0 1px var(--vscode-button-background);
    }
    
    .variant-item.selected .variant-name {
      color: var(--vscode-button-background);
      font-weight: 600;
    }
    
    .variant-colors {
      display: flex;
      gap: 2px;
    }
    
    .variant-color-dot {
      width: 16px;
      height: 16px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    .variant-name {
      font-size: 11px;
      color: var(--vscode-foreground);
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }
    
    .variant-actions {
      display: flex;
      gap: 2px;
      opacity: 0;
      transition: opacity 0.2s;
      margin-left: auto;
    }
    
    .variant-item:hover .variant-actions {
      opacity: 1;
    }
    
    .variant-edit, .variant-delete, .variant-set-default {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px;
      transition: all 0.2s;
      font-size: 10px;
    }
    
    .variant-edit:hover {
      color: var(--vscode-button-background);
    }
    
    .variant-delete:hover {
      color: var(--vscode-errorForeground);
    }
    
    .variant-set-default:hover {
      color: #73c991;
    }
    
    .variant-item.is-default {
      border-color: #73c991;
      background: rgba(115, 201, 145, 0.1);
    }
    
    .variant-set-default.active {
      color: #73c991;
    }
    
    .variant-save-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px;
      margin-left: auto;
      transition: all 0.2s;
    }
    
    .variant-save-btn:hover {
      color: var(--vscode-button-background);
    }
    
    /* Auto-generate Variants */
    .auto-variants {
      margin-bottom: 10px;
      padding: 8px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
    }
    
    .auto-variants-label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      display: block;
      margin-bottom: 6px;
    }
    
    .auto-variants-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    
    .auto-variant-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      font-size: 10px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      transition: all 0.15s;
    }
    
    .auto-variant-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .auto-variant-btn .codicon {
      font-size: 10px;
    }
    
    .no-Variants {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    
    .add-color-btn {
      display: none;
    }
    
    .current-color-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 4px;
      font-size: 10px;
    }
    
    .current-color-badge code {
      background: var(--vscode-textCodeBlock-background);
      padding: 1px 4px;
      border-radius: 2px;
      font-family: var(--font-mono);
    }
    
    .no-colors {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      font-size: 11px;
    }
    
    /* Optimize & Actions Row */
    .optimize-actions-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: start;
    }
    
    /* Optimize Presets */
    .optimize-presets {
      display: flex;
      gap: 8px;
    }
    
    .optimize-preset {
      flex: 1;
      padding: 8px 12px;
      font-size: 11px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 2px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s ease;
      text-align: center;
    }
    
    .optimize-preset:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
    }
    
    .optimize-preset.active {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    
    .optimize-result {
      display: none;
      padding: 12px;
      background: rgba(115, 201, 145, 0.1);
      border: 1px solid rgba(115, 201, 145, 0.3);
      border-radius: 8px;
      margin-top: 12px;
    }
    
    .optimize-result.visible {
      display: block;
    }
    
    .optimize-stats {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
    }
    
    .optimize-savings {
      color: #73c991;
      font-weight: 600;
      font-size: 14px;
    }
    
    .optimize-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    
    /* Buttons */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 16px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
    }
    
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .btn-success {
      background: rgba(115, 201, 145, 0.15);
      color: #73c991;
    }
    
    .btn-success:hover {
      background: rgba(115, 201, 145, 0.25);
    }

    .btn-warning {
      background: linear-gradient(135deg, rgba(204, 166, 82, 0.2), rgba(204, 120, 82, 0.2));
      color: #cca652;
    }

    .btn-warning:hover {
      background: linear-gradient(135deg, rgba(204, 166, 82, 0.3), rgba(204, 120, 82, 0.3));
    }
    
    /* Actions Section - Compact Toolbar */
    .actions-section {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      padding: 6px;
      background: var(--vscode-sideBar-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
    }
    
    .action-btn {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: scale(1.1);
    }
    
    .action-btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .action-btn.primary:hover {
      background: var(--vscode-button-hoverBackground);
    }
    
    .action-btn.warning {
      background: linear-gradient(135deg, rgba(204, 166, 82, 0.2), rgba(204, 120, 82, 0.2));
      color: #cca652;
    }
    
    .action-btn.warning:hover {
      background: linear-gradient(135deg, rgba(204, 166, 82, 0.3), rgba(204, 120, 82, 0.3));
    }
    
    .action-separator {
      width: 1px;
      height: 20px;
      background: var(--vscode-panel-border);
      margin: 0 2px;
    }
    
    /* Animation Tab Styles */
    .animation-types {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    
    .animation-type-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 8px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      color: var(--vscode-foreground);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .animation-type-btn:hover {
      background: var(--vscode-list-hoverBackground);
      border-color: var(--vscode-focusBorder);
    }
    
    .animation-type-btn.active {
      background: rgba(var(--vscode-button-background-rgb, 0, 122, 204), 0.15);
      border-color: var(--vscode-button-background);
      color: var(--vscode-button-background);
    }
    
    .animation-type-btn .codicon {
      font-size: 18px;
    }
    
    .animation-settings {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    
    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    
    .setting-row label {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      min-width: 70px;
    }
    
    .setting-control {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }
    
    .setting-control input[type="range"] {
      flex: 1;
      height: 4px;
      background: var(--vscode-scrollbarSlider-background);
      border-radius: 2px;
      appearance: none;
      cursor: pointer;
    }
    
    .setting-control input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: 14px;
      height: 14px;
      background: var(--vscode-button-background);
      border-radius: 50%;
      cursor: pointer;
    }
    
    .setting-control span {
      font-size: 11px;
      color: var(--vscode-foreground);
      min-width: 35px;
      text-align: right;
    }
    
    .setting-row select {
      flex: 1;
      padding: 6px 10px;
      background: var(--vscode-dropdown-background);
      border: 1px solid var(--vscode-dropdown-border);
      color: var(--vscode-dropdown-foreground);
      border-radius: 6px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .setting-row select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }
    
    .animation-export {
      display: flex;
      flex-direction: column;
      gap: 8px;
      align-items: center;
    }
    
    .animation-export .btn {
      width: 100%;
    }
    
    .animation-export .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .export-hint {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }
    
    /* Animation keyframes */
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-4px); }
      75% { transform: translateX(4px); }
    }
    
    @keyframes fade {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
    
    @keyframes spin-reverse {
      from { transform: rotate(360deg); }
      to { transform: rotate(0deg); }
    }
    
    @keyframes pulse-grow {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }
    
    @keyframes bounce-horizontal {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(8px); }
    }
    
    @keyframes shake-vertical {
      0%, 100% { transform: translateY(0); }
      25% { transform: translateY(-4px); }
      75% { transform: translateY(4px); }
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    
    @keyframes swing {
      0%, 100% { transform: rotate(0deg); transform-origin: top center; }
      25% { transform: rotate(15deg); }
      75% { transform: rotate(-15deg); }
    }
    
    @keyframes flip {
      0% { transform: perspective(400px) rotateY(0); }
      100% { transform: perspective(400px) rotateY(360deg); }
    }
    
    @keyframes flip-x {
      0% { transform: perspective(400px) rotateX(0); }
      100% { transform: perspective(400px) rotateX(360deg); }
    }
    
    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      14% { transform: scale(1.15); }
      28% { transform: scale(1); }
      42% { transform: scale(1.15); }
      70% { transform: scale(1); }
    }
    
    @keyframes wobble {
      0%, 100% { transform: translateX(0) rotate(0); }
      15% { transform: translateX(-6px) rotate(-5deg); }
      30% { transform: translateX(5px) rotate(3deg); }
      45% { transform: translateX(-4px) rotate(-3deg); }
      60% { transform: translateX(3px) rotate(2deg); }
      75% { transform: translateX(-2px) rotate(-1deg); }
    }
    
    @keyframes rubber-band {
      0%, 100% { transform: scaleX(1); }
      30% { transform: scaleX(1.25) scaleY(0.75); }
      40% { transform: scaleX(0.75) scaleY(1.25); }
      50% { transform: scaleX(1.15) scaleY(0.85); }
      65% { transform: scaleX(0.95) scaleY(1.05); }
      75% { transform: scaleX(1.05) scaleY(0.95); }
    }
    
    @keyframes jello {
      0%, 11.1%, 100% { transform: skewX(0) skewY(0); }
      22.2% { transform: skewX(-12.5deg) skewY(-12.5deg); }
      33.3% { transform: skewX(6.25deg) skewY(6.25deg); }
      44.4% { transform: skewX(-3.125deg) skewY(-3.125deg); }
      55.5% { transform: skewX(1.5625deg) skewY(1.5625deg); }
    }
    
    @keyframes tada {
      0%, 100% { transform: scale(1) rotate(0); }
      10%, 20% { transform: scale(0.9) rotate(-3deg); }
      30%, 50%, 70%, 90% { transform: scale(1.1) rotate(3deg); }
      40%, 60%, 80% { transform: scale(1.1) rotate(-3deg); }
    }
    
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes fade-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    
    @keyframes zoom-in {
      from { transform: scale(0); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    @keyframes zoom-out {
      from { transform: scale(1); opacity: 1; }
      to { transform: scale(0); opacity: 0; }
    }
    
    @keyframes slide-in-up {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slide-in-down {
      from { transform: translateY(-100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slide-in-left {
      from { transform: translateX(-100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slide-in-right {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }
    
    @keyframes glow {
      0%, 100% { filter: drop-shadow(0 0 2px currentColor); }
      50% { filter: drop-shadow(0 0 10px currentColor) drop-shadow(0 0 20px currentColor); }
    }
    
    @keyframes draw {
      from { stroke-dashoffset: var(--path-length, 1000); }
      to { stroke-dashoffset: 0; }
    }
    
    @keyframes draw-reverse {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: var(--path-length, 1000); }
    }
    
    @keyframes draw-loop {
      0% { stroke-dashoffset: var(--path-length, 1000); }
      45% { stroke-dashoffset: 0; }
      55% { stroke-dashoffset: 0; }
      100% { stroke-dashoffset: var(--path-length, 1000); }
    }
    
    .anim-spin { animation: spin var(--anim-duration, 1s) var(--anim-timing, linear) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-spin-reverse { animation: spin-reverse var(--anim-duration, 1s) var(--anim-timing, linear) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-pulse { animation: pulse var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-pulse-grow { animation: pulse-grow var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-bounce { animation: bounce var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-bounce-horizontal { animation: bounce-horizontal var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-shake { animation: shake var(--anim-duration, 0.5s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-shake-vertical { animation: shake-vertical var(--anim-duration, 0.5s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-fade { animation: fade var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); }
    .anim-fade-in { animation: fade-in var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); }
    .anim-fade-out { animation: fade-out var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); }
    .anim-float { animation: float var(--anim-duration, 2s) var(--anim-timing, ease-in-out) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-swing { animation: swing var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: top center; }
    .anim-flip { animation: flip var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-flip-x { animation: flip-x var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-heartbeat { animation: heartbeat var(--anim-duration, 1.5s) var(--anim-timing, ease-in-out) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-wobble { animation: wobble var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-rubber-band { animation: rubber-band var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-jello { animation: jello var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-tada { animation: tada var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); transform-origin: center; }
    .anim-zoom-in { animation: zoom-in var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); transform-origin: center; }
    .anim-zoom-out { animation: zoom-out var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); transform-origin: center; }
    .anim-slide-in-up { animation: slide-in-up var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); transform-origin: center; }
    .anim-slide-in-down { animation: slide-in-down var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); transform-origin: center; }
    .anim-slide-in-left { animation: slide-in-left var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); transform-origin: center; }
    .anim-slide-in-right { animation: slide-in-right var(--anim-duration, 1s) var(--anim-timing, ease) var(--anim-delay, 0s) var(--anim-iteration, 1) var(--anim-direction, normal); transform-origin: center; }
    .anim-blink { animation: blink var(--anim-duration, 1s) var(--anim-timing, step-end) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); }
    .anim-glow { animation: glow var(--anim-duration, 2s) var(--anim-timing, ease-in-out) var(--anim-delay, 0s) var(--anim-iteration, infinite) var(--anim-direction, normal); }
    
    /* Draw animations apply to SVG children */
    .anim-draw path, .anim-draw line, .anim-draw polyline, .anim-draw polygon, .anim-draw circle, .anim-draw ellipse, .anim-draw rect {
      --path-length: 1000;
      stroke-dasharray: var(--path-length);
      stroke-dashoffset: var(--path-length);
      animation: draw var(--anim-duration, 2s) var(--anim-timing, ease-in-out) var(--anim-delay, 0s) forwards;
    }
    .anim-draw-reverse path, .anim-draw-reverse line, .anim-draw-reverse polyline, .anim-draw-reverse polygon, .anim-draw-reverse circle, .anim-draw-reverse ellipse, .anim-draw-reverse rect {
      --path-length: 1000;
      stroke-dasharray: var(--path-length);
      stroke-dashoffset: 0;
      animation: draw-reverse var(--anim-duration, 2s) var(--anim-timing, ease-in-out) var(--anim-delay, 0s) forwards;
    }
    .anim-draw-loop path, .anim-draw-loop line, .anim-draw-loop polyline, .anim-draw-loop polygon, .anim-draw-loop circle, .anim-draw-loop ellipse, .anim-draw-loop rect {
      --path-length: 1000;
      stroke-dasharray: var(--path-length);
      stroke-dashoffset: var(--path-length);
      animation: draw-loop var(--anim-duration, 2s) var(--anim-timing, ease-in-out) var(--anim-delay, 0s) var(--anim-iteration, infinite);
    }
    
    /* Animation category buttons */
    .animation-categories {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    .anim-category-btn {
      padding: 6px 12px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 16px;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .anim-category-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    
    .anim-category-btn.active {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-button-background);
    }
    
    .draw-hint {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px 12px;
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 6px;
      font-size: 11px;
      color: var(--vscode-foreground);
      margin-top: 10px;
    }
    
    .draw-hint .codicon {
      flex-shrink: 0;
      margin-top: 1px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-left">
        <span class="icon-name" id="iconName">${name}</span>
        <button class="rename-btn" onclick="renameIcon()" title="Rename Icon">
          <span class="codicon codicon-edit"></span>
        </button>
        <span class="badge">Editor</span>
      </div>
      <span class="file-size" id="fileSize">${fileSizeStr}</span>
    </header>
    
    <div class="main-content">
      <!-- Left Column - Preview -->
      <div class="left-column">
        <div class="preview-code-container" id="previewCodeContainer">
          <div class="preview-section">
            <div class="preview-box zoom-3" id="previewBox">
              <div id="zoomContainer" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; transition: transform 0.2s ease;">
                ${displaySvg}
              </div>
            </div>
          </div>
        </div>
        <div class="zoom-controls">
          <button class="zoom-btn" onclick="zoomOut()" title="Zoom Out">
            <span class="codicon codicon-zoom-out"></span>
          </button>
          <span class="zoom-level" id="zoomLevel">100%</span>
          <button class="zoom-btn" onclick="zoomIn()" title="Zoom In">
            <span class="codicon codicon-zoom-in"></span>
          </button>
          <button class="zoom-btn" onclick="resetZoom()" title="Reset Zoom">
            <span class="codicon codicon-screen-normal"></span>
          </button>
          <span class="zoom-separator"></span>
          <button class="zoom-btn restart-anim-btn" id="restartAnimBtn" onclick="restartAnimation()" title="Restart Animation" style="display: none;">
            <span class="codicon codicon-debug-restart"></span>
          </button>
        </div>
        
        <!-- Actions Toolbar -->
        <div class="actions-section">
          ${location ? `
          <button class="action-btn primary" onclick="save()" title="Save to File">
            <span class="codicon codicon-save"></span>
          </button>
          <button class="action-btn" onclick="goToSource()" title="Go to Source">
            <span class="codicon codicon-go-to-file"></span>
          </button>
          <span class="action-separator"></span>
          ` : ''}
          <button class="action-btn warning" onclick="rebuild()" title="Build Icons">
            <span class="codicon codicon-sync"></span>
          </button>
          <button class="action-btn" onclick="copySvg()" title="Copy SVG">
            <span class="codicon codicon-copy"></span>
          </button>
        </div>

        <!-- Optimize Section -->
        <div class="section" style="margin-top: 12px;">
          <div class="section-title">
            <span class="codicon codicon-rocket"></span> Optimize (SVGO)
          </div>
          <div class="optimize-presets">
            <button class="optimize-preset" onclick="optimizeSvg('minimal')">Minimal</button>
            <button class="optimize-preset" onclick="optimizeSvg('safe')">Safe</button>
            <button class="optimize-preset" onclick="optimizeSvg('aggressive')">Aggressive</button>
          </div>
          <div class="optimize-result" id="optimizeResult">
            <div class="optimize-stats">
              <span id="optimizeOriginal">Original: --</span>
              <span id="optimizeNew">Optimized: --</span>
            </div>
            <div class="optimize-savings" id="optimizeSavings">Saved: --</div>
            <div class="optimize-actions">
              <button id="btnApplyOptimized" class="btn btn-success" onclick="applyOptimized()" disabled>
                <span class="codicon codicon-check"></span> Apply
              </button>
              <button class="btn" onclick="copyOptimized()">
                <span class="codicon codicon-copy"></span> Copy
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Right Column - Controls -->
      <div class="right-column">
        <div class="tabs-container">
          <div class="tabs-header">
            <button class="tab-btn active" onclick="switchTab('color')">
              <span class="codicon codicon-symbol-color"></span> Color
            </button>
            <button class="tab-btn" onclick="switchTab('animation')">
              <span class="codicon codicon-play"></span> Animation
            </button>
            <button class="tab-btn" onclick="switchTab('code')">
              <span class="codicon codicon-code"></span> Code
            </button>
          </div>
          
          <!-- Color Tab -->
          <div class="tab-content active" id="tab-color">
            <!-- Colors & Variants Row -->
            <div class="colors-Variants-row">
              <!-- Colors Section -->
              <div class="section">
                <div class="section-title">
                  <span class="codicon codicon-paintcan"></span> Colors
                </div>
          <div class="color-swatches">
            ${hasCurrentColor ? `
              <div class="current-color-badge">
                <span class="codicon codicon-paintcan"></span>
                Uses <code>currentColor</code>
              </div>
            ` : ''}
            ${svgColors.length > 0 ? svgColors.map(color => `
              <div class="color-item">
                <div class="color-swatch" style="background-color: ${color}" title="${color}">
                  <input type="color" value="${this._toHexColor(color)}" 
                    oninput="previewColor('${color}', this.value)" 
                    onchange="applyColor('${color}', this.value)" 
                    data-original="${color}" />
                </div>
              </div>
            `).join('') : (!hasCurrentColor ? '<span class="no-colors">No colors</span>' : '')}
          </div>
        </div>
    
              <!-- Variants Section -->
              <div class="section${svgColors.length === 0 ? ' disabled-section' : ''}">
                <div class="section-title">
                  <span class="codicon codicon-color-mode"></span> Variants
                  ${svgColors.length > 0 ? `
                  <button class="variant-save-btn" onclick="saveVariant()" title="Save current colors as variant">
                    <span class="codicon codicon-add"></span>
                  </button>
                  ` : ''}
                </div>
                ${svgColors.length === 0 ? `
                <div class="Variants-disabled-message">
                  <span class="codicon codicon-info"></span>
                  Variants not available for currentColor icons
                </div>
                ` : `
                <!-- Auto-generate Variants -->
                <div class="auto-variants">
                  <span class="auto-variants-label">Auto-generate:</span>
                  <div class="auto-variants-buttons">
                    <button class="auto-variant-btn" onclick="generateAutoVariant('invert')" title="Invert all colors">
                      <span class="codicon codicon-arrow-swap"></span> Invert
                    </button>
                    <button class="auto-variant-btn" onclick="generateAutoVariant('darken')" title="Darken all colors by 30%">
                      <span class="codicon codicon-circle-filled"></span> Dark
                    </button>
                    <button class="auto-variant-btn" onclick="generateAutoVariant('lighten')" title="Lighten all colors by 30%">
                      <span class="codicon codicon-circle-outline"></span> Light
                    </button>
                    <button class="auto-variant-btn" onclick="generateAutoVariant('muted')" title="Reduce saturation by 50%">
                      <span class="codicon codicon-color-mode"></span> Muted
                    </button>
                    <button class="auto-variant-btn" onclick="generateAutoVariant('grayscale')" title="Convert to grayscale">
                      <span class="codicon codicon-symbol-color"></span> Gray
                    </button>
                  </div>
                </div>
                <div class="Variants-container" id="VariantsContainer">
                  <div class="variant-item default${this._selectedVariantIndex === -1 ? ' selected' : ''}${!defaultVariant ? ' is-default' : ''}" onclick="applyDefaultVariant()" title="Original colors${!defaultVariant ? ' (active default)' : ''}">
                    <div class="variant-colors">
                      ${this._originalColors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}"></div>`).join('')}
                    </div>
                    <span class="variant-name">original</span>
                    <div class="variant-actions">
                      <button class="variant-set-default${!defaultVariant ? ' active' : ''}" onclick="event.stopPropagation(); setDefaultVariant(null)" title="${!defaultVariant ? 'Currently default' : 'Set as default'}">
                        <span class="codicon codicon-star${!defaultVariant ? '-full' : '-empty'}"></span>
                      </button>
                    </div>
                  </div>
                  ${this._getSavedVariants(name).map((variant, index) => `
                    <div class="variant-item${this._selectedVariantIndex === index ? ' selected' : ''}${defaultVariant === variant.name ? ' is-default' : ''}" onclick="applyVariant(${index})" title="${variant.name} - Click to apply${defaultVariant === variant.name ? ' (active default)' : ''}">
                      <div class="variant-colors">
                        ${variant.colors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}"></div>`).join('')}
                      </div>
                      <span class="variant-name">${variant.name}</span>
                      <div class="variant-actions">
                        <button class="variant-set-default${defaultVariant === variant.name ? ' active' : ''}" onclick="event.stopPropagation(); setDefaultVariant('${variant.name}')" title="${defaultVariant === variant.name ? 'Currently default' : 'Set as default'}">
                          <span class="codicon codicon-star${defaultVariant === variant.name ? '-full' : '-empty'}"></span>
                        </button>
                        <button class="variant-edit" onclick="event.stopPropagation(); editVariant(${index})" title="Update with current colors">
                          <span class="codicon codicon-edit"></span>
                        </button>
                        <button class="variant-delete" onclick="event.stopPropagation(); deleteVariant(${index})" title="Delete">
                          <span class="codicon codicon-trash"></span>
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
                `}
              </div>
            </div>
          </div>
          
          <!-- Animation Tab -->
          <div class="tab-content" id="tab-animation">
            <div class="section">
              <div class="section-title">
                <span class="codicon codicon-play-circle"></span> Animation Category
              </div>
              <div class="animation-categories">
                <button class="anim-category-btn active" onclick="showAnimCategory('basic')" data-category="basic">Basic</button>
                <button class="anim-category-btn" onclick="showAnimCategory('draw')" data-category="draw">Draw</button>
                <button class="anim-category-btn" onclick="showAnimCategory('attention')" data-category="attention">Attention</button>
                <button class="anim-category-btn" onclick="showAnimCategory('entrance')" data-category="entrance">Entrance</button>
              </div>
            </div>
            
            <!-- Basic Animations -->
            <div class="section anim-category-section" id="category-basic">
              <div class="section-title">
                <span class="codicon codicon-zap"></span> Basic Animations
              </div>
              <div class="animation-types">
                <button class="animation-type-btn" onclick="setAnimation('none')" data-type="none">
                  <span class="codicon codicon-close"></span> None
                </button>
                <button class="animation-type-btn" onclick="setAnimation('spin')" data-type="spin">
                  <span class="codicon codicon-sync"></span> Spin
                </button>
                <button class="animation-type-btn" onclick="setAnimation('spin-reverse')" data-type="spin-reverse">
                  <span class="codicon codicon-sync"></span> Spin ↺
                </button>
                <button class="animation-type-btn" onclick="setAnimation('pulse')" data-type="pulse">
                  <span class="codicon codicon-pulse"></span> Pulse
                </button>
                <button class="animation-type-btn" onclick="setAnimation('pulse-grow')" data-type="pulse-grow">
                  <span class="codicon codicon-expand-all"></span> Grow
                </button>
                <button class="animation-type-btn" onclick="setAnimation('bounce')" data-type="bounce">
                  <span class="codicon codicon-arrow-up"></span> Bounce
                </button>
                <button class="animation-type-btn" onclick="setAnimation('bounce-horizontal')" data-type="bounce-horizontal">
                  <span class="codicon codicon-arrow-right"></span> Bounce H
                </button>
                <button class="animation-type-btn" onclick="setAnimation('float')" data-type="float">
                  <span class="codicon codicon-cloud"></span> Float
                </button>
                <button class="animation-type-btn" onclick="setAnimation('fade')" data-type="fade">
                  <span class="codicon codicon-eye"></span> Fade
                </button>
                <button class="animation-type-btn" onclick="setAnimation('blink')" data-type="blink">
                  <span class="codicon codicon-eye-closed"></span> Blink
                </button>
                <button class="animation-type-btn" onclick="setAnimation('glow')" data-type="glow">
                  <span class="codicon codicon-lightbulb"></span> Glow
                </button>
              </div>
            </div>
            
            <!-- Draw Animations -->
            <div class="section anim-category-section" id="category-draw" style="display: none;">
              <div class="section-title">
                <span class="codicon codicon-edit"></span> Path Drawing
              </div>
              <div class="animation-types">
                <button class="animation-type-btn" onclick="setAnimation('none')" data-type="none">
                  <span class="codicon codicon-close"></span> None
                </button>
                <button class="animation-type-btn draw-type" onclick="setAnimation('draw')" data-type="draw">
                  <span class="codicon codicon-pencil"></span> Draw
                </button>
                <button class="animation-type-btn draw-type" onclick="setAnimation('draw-reverse')" data-type="draw-reverse">
                  <span class="codicon codicon-discard"></span> Undraw
                </button>
                <button class="animation-type-btn draw-type" onclick="setAnimation('draw-loop')" data-type="draw-loop">
                  <span class="codicon codicon-sync"></span> Draw Loop
                </button>
              </div>
              <div class="draw-hint">
                <span class="codicon codicon-info"></span>
                Draw animations work best on SVGs with strokes/outlines. Icons with only fills may need stroke added.
              </div>
            </div>
            
            <!-- Attention Animations -->
            <div class="section anim-category-section" id="category-attention" style="display: none;">
              <div class="section-title">
                <span class="codicon codicon-bell"></span> Attention Seekers
              </div>
              <div class="animation-types">
                <button class="animation-type-btn" onclick="setAnimation('none')" data-type="none">
                  <span class="codicon codicon-close"></span> None
                </button>
                <button class="animation-type-btn" onclick="setAnimation('shake')" data-type="shake">
                  <span class="codicon codicon-warning"></span> Shake
                </button>
                <button class="animation-type-btn" onclick="setAnimation('shake-vertical')" data-type="shake-vertical">
                  <span class="codicon codicon-arrow-swap"></span> Shake V
                </button>
                <button class="animation-type-btn" onclick="setAnimation('swing')" data-type="swing">
                  <span class="codicon codicon-bell"></span> Swing
                </button>
                <button class="animation-type-btn" onclick="setAnimation('wobble')" data-type="wobble">
                  <span class="codicon codicon-feedback"></span> Wobble
                </button>
                <button class="animation-type-btn" onclick="setAnimation('rubber-band')" data-type="rubber-band">
                  <span class="codicon codicon-mirror"></span> Rubber
                </button>
                <button class="animation-type-btn" onclick="setAnimation('jello')" data-type="jello">
                  <span class="codicon codicon-flame"></span> Jello
                </button>
                <button class="animation-type-btn" onclick="setAnimation('heartbeat')" data-type="heartbeat">
                  <span class="codicon codicon-heart"></span> Heartbeat
                </button>
                <button class="animation-type-btn" onclick="setAnimation('tada')" data-type="tada">
                  <span class="codicon codicon-megaphone"></span> Tada
                </button>
              </div>
            </div>
            
            <!-- Entrance Animations -->
            <div class="section anim-category-section" id="category-entrance" style="display: none;">
              <div class="section-title">
                <span class="codicon codicon-sign-in"></span> Entrance & Exit
              </div>
              <div class="animation-types">
                <button class="animation-type-btn" onclick="setAnimation('none')" data-type="none">
                  <span class="codicon codicon-close"></span> None
                </button>
                <button class="animation-type-btn" onclick="setAnimation('fade-in')" data-type="fade-in">
                  <span class="codicon codicon-eye"></span> Fade In
                </button>
                <button class="animation-type-btn" onclick="setAnimation('fade-out')" data-type="fade-out">
                  <span class="codicon codicon-eye-closed"></span> Fade Out
                </button>
                <button class="animation-type-btn" onclick="setAnimation('zoom-in')" data-type="zoom-in">
                  <span class="codicon codicon-zoom-in"></span> Zoom In
                </button>
                <button class="animation-type-btn" onclick="setAnimation('zoom-out')" data-type="zoom-out">
                  <span class="codicon codicon-zoom-out"></span> Zoom Out
                </button>
                <button class="animation-type-btn" onclick="setAnimation('slide-in-up')" data-type="slide-in-up">
                  <span class="codicon codicon-arrow-up"></span> Slide Up
                </button>
                <button class="animation-type-btn" onclick="setAnimation('slide-in-down')" data-type="slide-in-down">
                  <span class="codicon codicon-arrow-down"></span> Slide Down
                </button>
                <button class="animation-type-btn" onclick="setAnimation('slide-in-left')" data-type="slide-in-left">
                  <span class="codicon codicon-arrow-left"></span> Slide Left
                </button>
                <button class="animation-type-btn" onclick="setAnimation('slide-in-right')" data-type="slide-in-right">
                  <span class="codicon codicon-arrow-right"></span> Slide Right
                </button>
                <button class="animation-type-btn" onclick="setAnimation('flip')" data-type="flip">
                  <span class="codicon codicon-refresh"></span> Flip Y
                </button>
                <button class="animation-type-btn" onclick="setAnimation('flip-x')" data-type="flip-x">
                  <span class="codicon codicon-fold"></span> Flip X
                </button>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">
                <span class="codicon codicon-settings"></span> Animation Settings
              </div>
              <div class="animation-settings">
                <div class="setting-row">
                  <label>Duration</label>
                  <div class="setting-control">
                    <input type="range" id="animDuration" min="0.1" max="5" step="0.1" value="1" oninput="updateAnimationSetting('duration', this.value)">
                    <span id="animDurationValue">1s</span>
                  </div>
                </div>
                <div class="setting-row">
                  <label>Delay</label>
                  <div class="setting-control">
                    <input type="range" id="animDelay" min="0" max="2" step="0.1" value="0" oninput="updateAnimationSetting('delay', this.value)">
                    <span id="animDelayValue">0s</span>
                  </div>
                </div>
                <div class="setting-row">
                  <label>Timing</label>
                  <select id="animTiming" onchange="updateAnimationSetting('timing', this.value)">
                    <option value="linear">Linear</option>
                    <option value="ease" selected>Ease</option>
                    <option value="ease-in">Ease In</option>
                    <option value="ease-out">Ease Out</option>
                    <option value="ease-in-out">Ease In Out</option>
                    <option value="cubic-bezier(0.68, -0.55, 0.265, 1.55)">Elastic</option>
                    <option value="cubic-bezier(0.175, 0.885, 0.32, 1.275)">Back</option>
                    <option value="steps(10)">Steps (10)</option>
                    <option value="steps(5)">Steps (5)</option>
                  </select>
                </div>
                <div class="setting-row">
                  <label>Iteration</label>
                  <select id="animIteration" onchange="updateAnimationSetting('iteration', this.value)">
                    <option value="1">1 time</option>
                    <option value="2">2 times</option>
                    <option value="3">3 times</option>
                    <option value="5">5 times</option>
                    <option value="infinite" selected>Infinite</option>
                  </select>
                </div>
                <div class="setting-row">
                  <label>Direction</label>
                  <select id="animDirection" onchange="updateAnimationSetting('direction', this.value)">
                    <option value="normal" selected>Normal</option>
                    <option value="reverse">Reverse</option>
                    <option value="alternate">Alternate</option>
                    <option value="alternate-reverse">Alternate Reverse</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div class="section">
              <div class="section-title">
                <span class="codicon codicon-export"></span> Export
              </div>
              <div class="animation-export">
                <button class="btn btn-primary" onclick="copyWithAnimation()" id="copyAnimBtn" disabled>
                  <span class="codicon codicon-copy"></span> Copy with Animation
                </button>
                <span class="export-hint">SVG will include CSS animation</span>
              </div>
            </div>
            
          </div>
        
        <!-- Code Tab -->
        <div class="tab-content" id="tab-code">
          <div class="code-tab-container">
            <div class="code-tab-header">
              <div class="code-header-left">
                <span class="code-title">
                  <span class="codicon codicon-code"></span> SVG Source
                </span>
                <label class="code-toggle" id="animationToggle" style="display: none;">
                  <input type="checkbox" id="includeAnimationCheck" onchange="toggleAnimationInCode(this.checked)">
                  <span class="toggle-label">
                    <span class="codicon codicon-play"></span> Include Animation
                  </span>
                </label>
              </div>
              <div class="code-actions">
                <button class="code-action-btn" onclick="copySvgCode()" title="Copy to clipboard">
                  <span class="codicon codicon-copy"></span>
                </button>
              </div>
            </div>
            <div class="code-content" id="svgCodeTab">
              ${this._highlightSvgCode(svg)}
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    let currentZoom = 3;
    let optimizedSvg = null;
    let currentAnimation = '${detectedAnimation?.type || 'none'}';
    let animationSettings = { 
      duration: ${detectedAnimation?.settings?.duration || 1}, 
      timing: '${detectedAnimation?.settings?.timing || 'ease'}', 
      iteration: '${detectedAnimation?.settings?.iteration || 'infinite'}',
      delay: ${detectedAnimation?.settings?.delay || 0},
      direction: '${detectedAnimation?.settings?.direction || 'normal'}'
    };
    const zoomLevels = [50, 75, 100, 150, 200];
    
    // Initialize saved animation UI on load (but don't apply to preview)
    document.addEventListener('DOMContentLoaded', () => {
      if (currentAnimation !== 'none') {
        // Only update UI elements, not the preview animation
        document.querySelectorAll('.animation-type-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.getAttribute('data-type') === currentAnimation) {
            btn.classList.add('active');
          }
        });
        
        // Show correct category for the animation
        const drawAnims = ['draw', 'draw-reverse', 'draw-loop'];
        const attentionAnims = ['shake', 'shake-vertical', 'swing', 'wobble', 'rubber-band', 'jello', 'heartbeat', 'tada'];
        const entranceAnims = ['fade-in', 'fade-out', 'zoom-in', 'zoom-out', 'slide-in-up', 'slide-in-down', 'slide-in-left', 'slide-in-right', 'flip', 'flip-x'];
        
        let category = 'basic';
        if (drawAnims.includes(currentAnimation)) category = 'draw';
        else if (attentionAnims.includes(currentAnimation)) category = 'attention';
        else if (entranceAnims.includes(currentAnimation)) category = 'entrance';
        
        showAnimCategory(category);
        
        // Update export button
        const copyBtn = document.getElementById('copyAnimBtn');
        const hint = document.querySelector('.export-hint');
        if (copyBtn) {
          copyBtn.disabled = false;
          hint.textContent = 'SVG will include CSS animation';
        }
        
        // Update settings UI
        const durationEl = document.getElementById('animDuration');
        const durationValueEl = document.getElementById('animDurationValue');
        const delayEl = document.getElementById('animDelay');
        const delayValueEl = document.getElementById('animDelayValue');
        const timingEl = document.getElementById('animTiming');
        const iterationEl = document.getElementById('animIteration');
        const directionEl = document.getElementById('animDirection');
        
        if (durationEl) durationEl.value = animationSettings.duration;
        if (durationValueEl) durationValueEl.textContent = animationSettings.duration + 's';
        if (delayEl) delayEl.value = animationSettings.delay;
        if (delayValueEl) delayValueEl.textContent = animationSettings.delay + 's';
        if (timingEl) timingEl.value = animationSettings.timing;
        if (iterationEl) iterationEl.value = animationSettings.iteration;
        if (directionEl) directionEl.value = animationSettings.direction;
      }
    });
    
    function updateZoom() {
      const zoomContainer = document.getElementById('zoomContainer');
      const zoomLevel = document.getElementById('zoomLevel');
      
      const scale = zoomLevels[currentZoom - 1] / 100;
      if (zoomContainer) zoomContainer.style.transform = 'scale(' + scale + ')';
      zoomLevel.textContent = zoomLevels[currentZoom - 1] + '%';
    }
    
    function zoomIn() {
      if (currentZoom < 5) { currentZoom++; updateZoom(); }
    }
    
    function zoomOut() {
      if (currentZoom > 1) { currentZoom--; updateZoom(); }
    }
    
    function resetZoom() {
      currentZoom = 3; updateZoom();
    }
    
    let includeAnimationInCode = false;
    
    function copySvgCode() {
      const codeEl = document.querySelector('#svgCodeTab .code-block code');
      const code = codeEl ? codeEl.textContent : '';
      navigator.clipboard.writeText(code).then(() => {
        vscode.postMessage({ command: 'showMessage', message: 'SVG code copied to clipboard' });
      });
    }
    
    function toggleAnimationInCode(checked) {
      includeAnimationInCode = checked;
      vscode.postMessage({ 
        command: 'updateCodeWithAnimation', 
        includeAnimation: checked,
        animation: currentAnimation,
        settings: animationSettings
      });
    }
    
    function updateAnimationToggleVisibility() {
      const toggle = document.getElementById('animationToggle');
      if (toggle) {
        toggle.style.display = currentAnimation !== 'none' ? 'flex' : 'none';
        
        const checkbox = document.getElementById('includeAnimationCheck');
        if (currentAnimation === 'none') {
          // Reset checkbox when no animation
          if (checkbox) checkbox.checked = false;
          includeAnimationInCode = false;
        } else {
          // Auto-enable when animation is selected
          if (checkbox && !includeAnimationInCode) {
            checkbox.checked = true;
            includeAnimationInCode = true;
          }
        }
      }
    }
    
    function updateCodeView(newSvg) {
      // Refresh code view
      vscode.postMessage({ 
        command: 'updateCodeWithAnimation', 
        includeAnimation: includeAnimationInCode,
        animation: currentAnimation,
        settings: animationSettings
      });
    }

    function toHexColor(color) {
      // Handle named colors using a canvas
      if (color.startsWith('#')) {
        // Expand short hex to full hex
        if (color.length === 4) {
          return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }
        return color;
      }
      // Use canvas to convert named colors to hex
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = color;
      return ctx.fillStyle; // Returns hex color
    }
    
    let colorChangeTimeout = null;
    let lastColorChange = { oldColor: null, newColor: null };
    
    // Preview color change in real-time (while dragging)
    function previewColor(oldColor, newColor) {
      // Update swatch background immediately for visual feedback
      const input = event.target;
      if (input && input.parentElement) {
        input.parentElement.style.backgroundColor = newColor;
      }
      
      // Debounce the preview update
      lastColorChange = { oldColor, newColor };
      
      if (colorChangeTimeout) {
        clearTimeout(colorChangeTimeout);
      }
      
      colorChangeTimeout = setTimeout(() => {
        vscode.postMessage({ command: 'previewColor', oldColor: lastColorChange.oldColor, newColor: lastColorChange.newColor });
        colorChangeTimeout = null;
      }, 30);
    }
    
    // Apply color change (when picker closes)
    function applyColor(oldColor, newColor) {
      if (colorChangeTimeout) {
        clearTimeout(colorChangeTimeout);
        colorChangeTimeout = null;
      }
      vscode.postMessage({ command: 'changeColor', oldColor, newColor });
    }
    
    // Variant functions
    function saveVariant() {
      vscode.postMessage({ command: 'saveVariant' });
    }
    
    function generateAutoVariant(type) {
      vscode.postMessage({ command: 'generateAutoVariant', type });
    }
    
    function applyVariant(index) {
      vscode.postMessage({ command: 'applyVariant', index });
    }
    
    function applyDefaultVariant() {
      vscode.postMessage({ command: 'applyDefaultVariant' });
    }
    
    function setDefaultVariant(variantName) {
      vscode.postMessage({ command: 'setDefaultVariant', variantName });
    }
    
    function deleteVariant(index) {
      vscode.postMessage({ command: 'deleteVariant', index });
    }
    
    function editVariant(index) {
      vscode.postMessage({ command: 'editVariant', index });
    }
    
    function optimizeSvg(preset) {
      // Don't run if already disabled
      if (event.target.disabled) return;
      
      document.querySelectorAll('.optimize-preset').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      vscode.postMessage({ command: 'optimizeSvg', preset });
    }
    
    function resetOptimizationButtons() {
      document.querySelectorAll('.optimize-preset').forEach(btn => {
        btn.disabled = false;
        btn.textContent = btn.getAttribute('data-original-text') || btn.textContent;
        btn.classList.remove('active');
      });
      const resultEl = document.getElementById('optimizeResult');
      if (resultEl) resultEl.classList.remove('visible');
    }
    
    function applyOptimized() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'applyOptimizedSvg', svg: optimizedSvg });
      }
    }
    
    function copyOptimized() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'copySvg', svg: optimizedSvg });
      }
    }
    
    function save() {
      vscode.postMessage({ 
        command: 'save',
        includeAnimation: includeAnimationInCode,
        animation: currentAnimation,
        settings: animationSettings
      });
    }
    
    function rebuild() {
      vscode.postMessage({ 
        command: 'rebuild',
        animation: currentAnimation !== 'none' ? currentAnimation : null,
        animationSettings: currentAnimation !== 'none' ? animationSettings : null
      });
    }
    
    function copySvg() {
      const svg = document.querySelector('.preview-box svg');
      vscode.postMessage({ 
        command: 'copySvg', 
        svg: svg?.outerHTML,
        animation: currentAnimation !== 'none' ? currentAnimation : null,
        animationSettings: currentAnimation !== 'none' ? animationSettings : null
      });
    }
    
    function goToSource() {
      vscode.postMessage({ command: 'goToSource' });
    }
    
    function renameIcon() {
      const currentName = document.getElementById('iconName').textContent;
      vscode.postMessage({ command: 'requestRename', currentName: currentName });
    }
    
    // Store original text for reset
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.optimize-preset').forEach(btn => {
        btn.setAttribute('data-original-text', btn.textContent);
      });
    });
    
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'previewUpdated') {
        // Only update SVG preview, don't touch swatches (picker is open)
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
      }
      
      if (message.command === 'nameUpdated') {
        // Update the name in the header
        document.getElementById('iconName').textContent = message.newName;
      }
      
      if (message.command === 'colorChanged') {
        resetOptimizationButtons();
        // Update preview
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
        
        // Update color swatches
        if (message.colors) {
          const swatchesContainer = document.querySelector('.color-swatches');
          if (swatchesContainer) {
            let swatchesHtml = '';
            
            if (message.hasCurrentColor) {
              swatchesHtml += \`
                <div class="current-color-badge">
                  <span class="codicon codicon-paintcan"></span>
                  Uses <code>currentColor</code>
                </div>
              \`;
            }
            
            if (message.colors.length > 0) {
              message.colors.forEach(color => {
                const hexColor = toHexColor(color);
                swatchesHtml += \`
                  <div class="color-item">
                    <div class="color-swatch" style="background-color: \${color}" title="\${color}">
                      <input type="color" value="\${hexColor}" 
                        oninput="previewColor('\${color}', this.value)" 
                        onchange="applyColor('\${color}', this.value)" 
                        data-original="\${color}" />
                    </div>
                  </div>
                \`;
              });
            } else if (!message.hasCurrentColor) {
              swatchesHtml += '<span class="no-colors">No colors detected</span>';
            }
            
            swatchesHtml += \`
              <button class="add-color-btn" onclick="addColor()" title="Add fill color">
                <span class="codicon codicon-add"></span>
              </button>
            \`;
            
            swatchesContainer.innerHTML = swatchesHtml;
          }
        }
      }
      
      if (message.command === 'optimizeResult') {
        optimizedSvg = message.svg;
        const resultEl = document.getElementById('optimizeResult');
        resultEl.classList.add('visible');
        document.getElementById('optimizeOriginal').textContent = 'Original: ' + message.originalSizeStr;
        document.getElementById('optimizeNew').textContent = 'Optimized: ' + message.optimizedSizeStr;
        document.getElementById('optimizeSavings').textContent = 
          'Saved: ' + (message.savingsPercent > 0 ? message.savingsPercent.toFixed(1) + '%' : 'Already optimal');
        
        const btnApply = document.getElementById('btnApplyOptimized');
        if (btnApply) {
          btnApply.disabled = message.savingsPercent <= 0;
        }

        // If no savings, disable the active button and mark as optimized
        if (message.savingsPercent <= 0) {
          const activeBtn = document.querySelector('.optimize-preset.active');
          if (activeBtn) {
            activeBtn.disabled = true;
            activeBtn.textContent = 'Optimized';
            
            // Also disable lower levels if Aggressive is optimized
            const presets = ['Minimal', 'Safe', 'Aggressive'];
            const activeText = activeBtn.getAttribute('data-original-text');
            const activeIndex = presets.indexOf(activeText);
            
            if (activeIndex >= 0) {
              document.querySelectorAll('.optimize-preset').forEach(btn => {
                const btnText = btn.getAttribute('data-original-text');
                const btnIndex = presets.indexOf(btnText);
                if (btnIndex <= activeIndex) {
                  btn.disabled = true;
                  btn.textContent = 'Optimized';
                }
              });
            }
          }
        }
      }

      if (message.command === 'optimizedSvgApplied') {
        // Update preview
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
        
        // Update code tab
        const codeEl = document.getElementById('svgCodeTab');
        if (codeEl) {
          codeEl.innerHTML = message.code;
        }
        
        // Update header file size
        const fileSizeEl = document.getElementById('fileSize');
        if (fileSizeEl) {
          const newSize = new Blob([message.svg]).size;
          const newSizeStr = newSize < 1024 ? newSize + ' B' : (newSize / 1024).toFixed(1) + ' KB';
          fileSizeEl.textContent = newSizeStr;
        }

        // Hide optimization result UI
        const resultEl = document.getElementById('optimizeResult');
        if (resultEl) {
           resultEl.classList.remove('visible');
        }
        
        // Disable the applied button and lower levels
        const activeBtn = document.querySelector('.optimize-preset.active');
        if (activeBtn) {
          activeBtn.disabled = true;
          activeBtn.textContent = 'Optimized';
          activeBtn.classList.remove('active');
          
          const presets = ['Minimal', 'Safe', 'Aggressive'];
          const activeText = activeBtn.getAttribute('data-original-text');
          const activeIndex = presets.indexOf(activeText);
          
          if (activeIndex >= 0) {
            document.querySelectorAll('.optimize-preset').forEach(btn => {
              const btnText = btn.getAttribute('data-original-text');
              const btnIndex = presets.indexOf(btnText);
              if (btnIndex <= activeIndex) {
                btn.disabled = true;
                btn.textContent = 'Optimized';
              }
            });
          }
        }
      }
      
      if (message.command === 'updateVariantselection') {
        resetOptimizationButtons();
        document.querySelectorAll('.variant-item').forEach((el, idx) => {
          if (idx === message.selectedIndex) {
            el.classList.add('selected');
          } else {
            el.classList.remove('selected');
          }
        });
      }
      
      if (message.command === 'updateCodeTab') {
        // If code changed (e.g. animation added), reset optimization buttons
        // But only if it's not just a highlight update
        // We can assume any code update might change optimization status
        // EXCEPT if it came from optimization itself (handled above)
        // But updateCodeTab is called by optimizedSvgApplied too...
        // Wait, optimizedSvgApplied calls updateCodeTab? No, it sends 'optimizedSvgApplied' which updates code tab manually in frontend.
        // But 'updateCodeWithAnimation' sends 'updateCodeTab'.
        
        // If message.hasAnimation is true, we added animation, so SVG changed -> reset buttons
        if (message.hasAnimation) {
           resetOptimizationButtons();
        }
        
        const codeEl = document.getElementById('svgCodeTab');
        if (codeEl) {
          codeEl.innerHTML = message.code;
        }
        
        // Update file size if provided
        if (message.size !== undefined) {
          const fileSizeEl = document.getElementById('fileSize');
          if (fileSizeEl) {
            const newSize = message.size;
            const newSizeStr = newSize < 1024 ? newSize + ' B' : (newSize / 1024).toFixed(1) + ' KB';
            fileSizeEl.innerHTML = newSizeStr + (message.hasAnimation ? ' <span style="opacity:0.7; font-size:0.9em">(anim)</span>' : '');
          }
        }
      }
    });
    
    // Tab switching
    function switchTab(tabName) {
      // Update tab buttons
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.onclick.toString().includes(tabName)) {
          btn.classList.add('active');
        }
      });
      
      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById('tab-' + tabName).classList.add('active');
    }
    
    // Animation functions
    function setAnimation(type) {
      currentAnimation = type;
      
      // Update active button
      document.querySelectorAll('.animation-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-type') === type) {
          btn.classList.add('active');
        }
      });
      
      // Update export button state
      const copyBtn = document.getElementById('copyAnimBtn');
      const hint = document.querySelector('.export-hint');
      if (type === 'none') {
        copyBtn.disabled = true;
        hint.textContent = 'Select an animation to enable';
      } else {
        copyBtn.disabled = false;
        hint.textContent = 'SVG will include CSS animation';
      }
      
      // Show/hide restart animation button
      const restartBtn = document.getElementById('restartAnimBtn');
      if (restartBtn) {
        restartBtn.style.display = type === 'none' ? 'none' : 'flex';
      }
      
      // Update animation toggle visibility in code tab
      updateAnimationToggleVisibility();
      
      // Update code if animation is included
      if (includeAnimationInCode) {
        updateCodeView();
      }
      
      // Update preview
      updateAnimationPreview();
    }
    
    function restartAnimation() {
      if (currentAnimation === 'none') return;
      
      const svg = document.querySelector('.preview-box svg');
      if (!svg) return;
      
      // Remove all animation classes
      svg.classList.forEach(cls => {
        if (cls.startsWith('anim-')) {
          svg.classList.remove(cls);
        }
      });
      
      // Reset inline styles for draw animations
      const pathElements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
      pathElements.forEach(el => {
        el.style.animation = '';
        el.style.strokeDasharray = '';
        el.style.strokeDashoffset = '';
      });
      
      // Force reflow to restart animation
      void svg.offsetWidth;
      
      // Small delay to ensure DOM updates
      setTimeout(() => {
        updateAnimationPreview();
      }, 10);
    }
    
    function copyWithAnimation() {
      if (currentAnimation === 'none') return;
      
      vscode.postMessage({
        command: 'copyWithAnimation',
        animation: currentAnimation,
        settings: animationSettings
      });
    }
    
    function updateAnimationSetting(setting, value) {
      animationSettings[setting] = value;
      
      if (setting === 'duration') {
        document.getElementById('animDurationValue').textContent = value + 's';
      }
      if (setting === 'delay') {
        document.getElementById('animDelayValue').textContent = value + 's';
      }
      
      updateAnimationPreview();
      
      // Update code view if animation is included
      if (includeAnimationInCode) {
        updateCodeView();
      }
    }
    
    function updateAnimationPreview() {
      // Apply animation to main preview
      const previewBox = document.getElementById('previewBox');
      const svg = previewBox.querySelector('svg');
      if (!svg) return;
      
      // Remove all animation classes
      const animClasses = ['anim-spin', 'anim-spin-reverse', 'anim-pulse', 'anim-pulse-grow', 
        'anim-bounce', 'anim-bounce-horizontal', 'anim-shake', 'anim-shake-vertical', 
        'anim-fade', 'anim-fade-in', 'anim-fade-out', 'anim-float', 'anim-swing', 
        'anim-flip', 'anim-flip-x', 'anim-heartbeat', 'anim-wobble', 'anim-rubber-band', 
        'anim-jello', 'anim-tada', 'anim-zoom-in', 'anim-zoom-out', 
        'anim-slide-in-up', 'anim-slide-in-down', 'anim-slide-in-left', 'anim-slide-in-right',
        'anim-blink', 'anim-glow', 'anim-draw', 'anim-draw-reverse', 'anim-draw-loop'];
      animClasses.forEach(cls => svg.classList.remove(cls));
      
      // Reset path styles for draw animations
      const pathElements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
      pathElements.forEach(el => {
        el.style.removeProperty('--path-length');
        el.style.removeProperty('stroke-dasharray');
        el.style.removeProperty('stroke-dashoffset');
        el.style.removeProperty('animation');
      });
      
      // Set CSS variables for animation settings
      svg.style.setProperty('--anim-duration', animationSettings.duration + 's');
      svg.style.setProperty('--anim-timing', animationSettings.timing);
      svg.style.setProperty('--anim-iteration', animationSettings.iteration);
      svg.style.setProperty('--anim-delay', animationSettings.delay + 's');
      svg.style.setProperty('--anim-direction', animationSettings.direction);
      
      // Add new animation class
      if (currentAnimation !== 'none') {
        svg.classList.add('anim-' + currentAnimation);
        
        // For draw animations, calculate actual path lengths
        if (currentAnimation === 'draw' || currentAnimation === 'draw-reverse' || currentAnimation === 'draw-loop') {
          pathElements.forEach(el => {
            let pathLength = 100; // Default fallback
            try {
              if (typeof el.getTotalLength === 'function') {
                pathLength = el.getTotalLength();
              }
            } catch (e) {
              // Some elements don't support getTotalLength
            }
            el.style.setProperty('--path-length', pathLength.toString());
            el.style.strokeDasharray = pathLength.toString();
            
            // Set initial state and animation based on type
            const duration = animationSettings.duration + 's';
            const timing = animationSettings.timing;
            const delay = animationSettings.delay + 's';
            const iteration = animationSettings.iteration;
            
            if (currentAnimation === 'draw') {
              el.style.strokeDashoffset = pathLength.toString();
              el.style.animation = 'draw ' + duration + ' ' + timing + ' ' + delay + ' forwards';
            } else if (currentAnimation === 'draw-reverse') {
              el.style.strokeDashoffset = '0';
              el.style.animation = 'draw-reverse ' + duration + ' ' + timing + ' ' + delay + ' forwards';
            } else if (currentAnimation === 'draw-loop') {
              el.style.strokeDashoffset = pathLength.toString();
              el.style.animation = 'draw-loop ' + duration + ' ' + timing + ' ' + delay + ' ' + iteration;
            }
          });
        }
      }
    }
    
    // Animation category switching
    function showAnimCategory(category) {
      // Update category buttons
      document.querySelectorAll('.anim-category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === category) {
          btn.classList.add('active');
        }
      });
      
      // Show/hide category sections
      document.querySelectorAll('.anim-category-section').forEach(section => {
        section.style.display = 'none';
      });
      document.getElementById('category-' + category).style.display = 'block';
    }
    
    // Initialize animation type button
    document.querySelector('.animation-type-btn[data-type="none"]')?.classList.add('active');
  </script>
</body>
</html>`;
  }
}
