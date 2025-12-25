import * as vscode from 'vscode';
import { SvgOptimizer } from '../services/SvgOptimizer';
import { getSvgConfig } from '../utils/config';

interface IconDetails {
  name: string;
  svg: string;
  location?: { file: string; line: number };
  isBuilt?: boolean;
}

const svgOptimizer = new SvgOptimizer();

export class IconDetailsPanel {
  public static currentPanel: IconDetailsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _iconDetails?: IconDetails;
  private _originalColors: string[] = [];
  private _selectedVariantIndex: number = -1;

  public static createOrShow(extensionUri: vscode.Uri, details?: IconDetails) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (IconDetailsPanel.currentPanel) {
      IconDetailsPanel.currentPanel._panel.reveal(column);
      if (details) {
        IconDetailsPanel.currentPanel._iconDetails = details;
        IconDetailsPanel.currentPanel._originalColors = IconDetailsPanel.currentPanel._extractColorsFromSvg(details.svg).colors;
        IconDetailsPanel.currentPanel._selectedVariantIndex = -1;
        IconDetailsPanel.currentPanel._update(details);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'iconDetails',
      'Icon Details',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
        retainContextWhenHidden: true
      }
    );

    IconDetailsPanel.currentPanel = new IconDetailsPanel(panel, extensionUri, details);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, details?: IconDetails) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._iconDetails = details;
    if (details) {
      this._originalColors = this._extractColorsFromSvg(details.svg).colors;
    }

    this._update(details);

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Reveal in tree view when panel becomes visible (tab selected)
    this._panel.onDidChangeViewState(e => {
      if (e.webviewPanel.visible && this._iconDetails) {
        vscode.commands.executeCommand('iconManager.revealInTree', this._iconDetails.name, this._iconDetails.location?.file, this._iconDetails.location?.line);
      }
    }, null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'goToLocation':
            if (this._iconDetails?.location) {
              const uri = vscode.Uri.file(this._iconDetails.location.file);
              const position = new vscode.Position(this._iconDetails.location.line - 1, 0);
              vscode.window.showTextDocument(uri, {
                selection: new vscode.Range(position, position),
                preview: false
              });
            }
            break;
          case 'copyName':
            if (this._iconDetails?.name) {
              vscode.env.clipboard.writeText(this._iconDetails.name);
              vscode.window.showInformationMessage(`Copied "${this._iconDetails.name}" to clipboard`);
            }
            break;
          case 'copySvg':
            const svgToCopy = message.svg || this._iconDetails?.svg;
            if (svgToCopy) {
              vscode.env.clipboard.writeText(svgToCopy);
              vscode.window.showInformationMessage('SVG copied to clipboard');
            }
            break;
          case 'optimizeSvg':
            if (this._iconDetails?.svg) {
              const preset = message.preset || 'safe';
              const presets = svgOptimizer.getPresets();
              const result = svgOptimizer.optimize(this._iconDetails.svg, presets[preset] || presets.safe);
              
              this._panel.webview.postMessage({
                command: 'optimizeResult',
                ...result,
                originalSizeStr: svgOptimizer.formatSize(result.originalSize),
                optimizedSizeStr: svgOptimizer.formatSize(result.optimizedSize)
              });
              
              if (result.savingsPercent > 0) {
                vscode.window.showInformationMessage(
                  `SVG optimized! Saved ${svgOptimizer.formatSize(result.savings)} (${result.savingsPercent.toFixed(1)}%)`
                );
              } else {
                vscode.window.showInformationMessage('SVG is already optimized');
              }
            }
            break;
          case 'applyOptimizedSvg':
            if (this._iconDetails && message.svg) {
              this._iconDetails.svg = message.svg;
              // Save to file if location is available
              if (this._iconDetails.location) {
                await this._saveSvgToFile(message.svg);
              } else {
                vscode.window.showInformationMessage('Optimized SVG applied (in memory only - no source file)');
              }
            }
            break;
          case 'changeColor':
            if (this._iconDetails?.svg && message.oldColor && message.newColor) {
              const updatedSvg = this._replaceColorInSvg(this._iconDetails.svg, message.oldColor, message.newColor);
              this._iconDetails.svg = updatedSvg;
              this._panel.webview.postMessage({
                command: 'colorChanged',
                svg: updatedSvg
              });
              // Save to file if location is available
              if (this._iconDetails.location) {
                await this._saveSvgToFile(updatedSvg);
              }
            }
            break;
          case 'addColorToSvg':
            if (this._iconDetails?.svg && message.color) {
              // Add fill color to the SVG
              let updatedSvg = this._iconDetails.svg;
              // Find the svg tag and add fill attribute, or replace existing one
              if (updatedSvg.includes('fill=')) {
                // Replace the first fill attribute on SVG element
                updatedSvg = updatedSvg.replace(/<svg([^>]*)fill=["'][^"']*["']/, `<svg$1fill="${message.color}"`);
              } else {
                // Add fill to the svg tag
                updatedSvg = updatedSvg.replace(/<svg/, `<svg fill="${message.color}"`);
              }
              this._iconDetails.svg = updatedSvg;
              // Refresh panel with updated SVG
              this._update();
              vscode.window.showInformationMessage(`Added fill color: ${message.color}`);
              // Save to file if location is available
              if (this._iconDetails.location) {
                await this._saveSvgToFile(updatedSvg);
              }
            }
            break;
          case 'saveSvg':
            if (this._iconDetails?.svg) {
              await this._saveSvgToFile(message.svg || this._iconDetails.svg);
            }
            break;
          case 'findUsages':
            if (this._iconDetails?.name) {
              this._findIconUsages(this._iconDetails.name);
            }
            break;
          case 'goToUsage':
            if (message.file && message.line) {
              const uri = vscode.Uri.file(message.file);
              const position = new vscode.Position(message.line - 1, 0);
              vscode.window.showTextDocument(uri, {
                selection: new vscode.Range(position, position),
                preview: true
              });
            }
            break;
          case 'applyVariant':
            if (this._iconDetails && message.index !== undefined) {
              const Variants = this._getSavedVariants(this._iconDetails.name);
              const variant = Variants[message.index];
              if (variant) {
                const currentColors = this._extractColorsFromSvg(this._iconDetails.svg).colors;
                let newSvg = this._iconDetails.svg;
                
                // Replace colors in order
                for (let i = 0; i < Math.min(currentColors.length, variant.colors.length); i++) {
                  newSvg = this._replaceColorInSvg(newSvg, currentColors[i], variant.colors[i]);
                }
                
                this._iconDetails.svg = newSvg;
                this._selectedVariantIndex = message.index;
                this._update();
                // Save to file if location is available
                if (this._iconDetails.location) {
                  await this._saveSvgToFile(newSvg);
                }
              }
            }
            break;
          case 'applyDefaultVariant':
            if (this._iconDetails && this._originalColors.length > 0) {
              const currentColors = this._extractColorsFromSvg(this._iconDetails.svg).colors;
              let newSvg = this._iconDetails.svg;
              
              // Replace colors back to original
              for (let i = 0; i < Math.min(currentColors.length, this._originalColors.length); i++) {
                newSvg = this._replaceColorInSvg(newSvg, currentColors[i], this._originalColors[i]);
              }
              
              this._iconDetails.svg = newSvg;
              this._selectedVariantIndex = -1;
              this._update();
              // Save to file if location is available
              if (this._iconDetails.location) {
                await this._saveSvgToFile(newSvg);
              }
            }
            break;
          case 'saveVariant':
            if (this._iconDetails) {
              const variantName = await vscode.window.showInputBox({
                prompt: 'Enter variant name',
                placeHolder: 'e.g. Dark theme, Primary colors...'
              });
              if (variantName) {
                const { colors } = this._extractColorsFromSvg(this._iconDetails.svg);
                this._saveVariant(this._iconDetails.name, variantName, colors);
                this._update();
                vscode.window.showInformationMessage(`Variant "${variantName}" saved`);
              }
            }
            break;
          case 'deleteVariant':
            if (this._iconDetails && message.index !== undefined) {
              this._deleteVariant(this._iconDetails.name, message.index);
              // If deleted variant was the default, clear default
              const Variants = this._getSavedVariants(this._iconDetails.name);
              const variantNames = Variants.map(s => s.name);
              const currentDefault = this._getDefaultVariant(this._iconDetails.name);
              if (currentDefault && !variantNames.includes(currentDefault)) {
                this._setDefaultVariant(this._iconDetails.name, null);
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
            if (this._iconDetails) {
              const variantName = message.variantName; // null to clear, string to set
              this._setDefaultVariant(this._iconDetails.name, variantName);
              this._update();
              if (variantName) {
                vscode.window.showInformationMessage(`"${variantName}" is now the default Variant for ${this._iconDetails.name}`);
              } else {
                vscode.window.showInformationMessage(`default variant cleared for ${this._iconDetails.name}`);
              }
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  private _replaceColorInSvg(svg: string, oldColor: string, newColor: string): string {
    // Normalize colors for comparison
    const normalizeColor = (color: string): string => {
      color = color.toLowerCase().trim();
      // Convert 3-digit hex to 6-digit
      if (/^#[0-9a-f]{3}$/i.test(color)) {
        color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    };

    const oldNorm = normalizeColor(oldColor);
    const newNorm = normalizeColor(newColor);

    // Replace in fill, stroke, stop-color, and style attributes
    let result = svg;
    
    // Replace in attributes (fill="...", stroke="...", etc.)
    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)=["']${oldNorm}["']`, 'gi'),
      `$1="${newNorm}"`
    );
    
    // Also try with original color format
    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)=["']${oldColor}["']`, 'gi'),
      `$1="${newNorm}"`
    );

    // Replace in style attributes
    result = result.replace(
      new RegExp(`(fill|stroke|stop-color|flood-color|lighting-color)\\s*:\\s*${oldNorm}`, 'gi'),
      `$1:${newNorm}`
    );

    return result;
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

  private _extractColorsFromSvg(svg: string): { colors: string[]; hasCurrentColor: boolean } {
    const colorRegex = /(fill|stroke|stop-color)=["']([^"']+)["']/gi;
    const styleColorRegex = /(fill|stroke|stop-color)\s*:\s*([^;"'\s]+)/gi;
    const colorsSet = new Set<string>();
    let hasCurrentColor = false;
    
    let match;
    while ((match = colorRegex.exec(svg)) !== null) {
      const color = match[2].toLowerCase();
      if (color === 'currentcolor') {
        hasCurrentColor = true;
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    while ((match = styleColorRegex.exec(svg)) !== null) {
      const color = match[2].toLowerCase();
      if (color === 'currentcolor') {
        hasCurrentColor = true;
      } else if (color !== 'none' && color !== 'transparent' && !color.startsWith('url(')) {
        colorsSet.add(color);
      }
    }
    
    return { colors: Array.from(colorsSet), hasCurrentColor };
  }

  private async _saveSvgToFile(svg: string): Promise<boolean> {
    if (!this._iconDetails?.location) {
      vscode.window.showWarningMessage('No source file location available');
      return false;
    }

    const { file, line } = this._iconDetails.location;

    try {
      const uri = vscode.Uri.file(file);
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();

      // Check if it's a standalone SVG file
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
        
        // Trigger refresh of the icon tree
        vscode.commands.executeCommand('iconManager.refreshIcons');
        
        vscode.window.showInformationMessage(`Saved changes to ${file.split(/[/\\]/).pop()}`);
        return true;
      }

      // For inline SVGs, find and replace the SVG at the specified line
      const lineOffset = document.offsetAt(new vscode.Position(line - 1, 0));
      const svgStartIndex = text.indexOf('<svg', lineOffset);
      
      if (svgStartIndex === -1) {
        vscode.window.showErrorMessage('Could not find SVG in the source file');
        return false;
      }

      // Find the closing </svg> tag
      let depth = 0;
      let svgEndIndex = -1;
      let i = svgStartIndex;
      
      while (i < text.length) {
        if (text.substring(i, i + 4) === '<svg') {
          depth++;
          i += 4;
        } else if (text.substring(i, i + 6) === '</svg>') {
          depth--;
          if (depth === 0) {
            svgEndIndex = i + 6;
            break;
          }
          i += 6;
        } else {
          i++;
        }
      }

      if (svgEndIndex === -1) {
        vscode.window.showErrorMessage('Could not find closing </svg> tag');
        return false;
      }

      const startPos = document.positionAt(svgStartIndex);
      const endPos = document.positionAt(svgEndIndex);

      const edit = new vscode.WorkspaceEdit();
      edit.replace(uri, new vscode.Range(startPos, endPos), svg);
      await vscode.workspace.applyEdit(edit);
      await document.save();

      // Trigger refresh of the icon tree
      vscode.commands.executeCommand('iconManager.refreshIcons');

      vscode.window.showInformationMessage(`Saved changes to ${file.split(/[/\\]/).pop()}`);
      return true;
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save: ${error}`);
      return false;
    }
  }

  private async _findIconUsages(iconName: string) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      this._panel.webview.postMessage({ command: 'usagesResult', usages: [], total: 0 });
      return;
    }

    const usages: { file: string; line: number; preview: string }[] = [];
    
    const patterns = [
      `name="${iconName}"`,
      `name='${iconName}'`,
      `"${iconName}"`,
      `'${iconName}'`,
      `icon-${iconName}`,
      `.${iconName}`,
      `#${iconName}`,
    ];

    const includePattern = '**/*.{ts,tsx,js,jsx,vue,html,css,scss,less,svelte,astro}';
    const excludePattern = '**/node_modules/**,**/dist/**,**/build/**,**/.git/**';

    try {
      const files = await vscode.workspace.findFiles(includePattern, excludePattern, 500);
      
      for (const file of files) {
        try {
          const document = await vscode.workspace.openTextDocument(file);
          const text = document.getText();
          
          for (const pattern of patterns) {
            let index = 0;
            while ((index = text.indexOf(pattern, index)) !== -1) {
              const position = document.positionAt(index);
              const line = position.line;
              const lineText = document.lineAt(line).text.trim();
              
              const existing = usages.find(u => u.file === file.fsPath && u.line === line + 1);
              if (!existing) {
                usages.push({
                  file: file.fsPath,
                  line: line + 1,
                  preview: lineText.substring(0, 100) + (lineText.length > 100 ? '...' : '')
                });
              }
              index += pattern.length;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }

      usages.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

      this._panel.webview.postMessage({ 
        command: 'usagesResult', 
        usages: usages,
        total: usages.length 
      });
    } catch (error) {
      this._panel.webview.postMessage({ command: 'usagesResult', usages: [], total: 0 });
    }
  }

  public dispose() {
    IconDetailsPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private _update(details?: IconDetails) {
    if (details) {
      this._iconDetails = details;
      this._panel.title = `Details: ${details.name}`;
    }
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview(): string {
    if (!this._iconDetails) {
      return `<!DOCTYPE html>
<html><body><p>No icon selected</p></body></html>`;
    }

    const { name, svg, location, isBuilt } = this._iconDetails;

    // Extract data from SVG
    const viewBoxMatch = svg.match(/viewBox=["']([^"']+)["']/);
    const viewBox = viewBoxMatch ? viewBoxMatch[1] : '0 0 24 24';
    
    const widthMatch = svg.match(/width=["']([^"']+)["']/);
    const heightMatch = svg.match(/height=["']([^"']+)["']/);
    const dimensions = widthMatch && heightMatch ? `${widthMatch[1]} × ${heightMatch[1]}` : null;
    
    const fileSize = new Blob([svg]).size;
    const fileSizeStr = fileSize < 1024 ? `${fileSize} B` : `${(fileSize / 1024).toFixed(1)} KB`;
    
    const pathCount = (svg.match(/<path/g) || []).length;
    const circleCount = (svg.match(/<circle/g) || []).length;
    const rectCount = (svg.match(/<rect/g) || []).length;
    const lineCount = (svg.match(/<line/g) || []).length;
    const polygonCount = (svg.match(/<polygon/g) || []).length;
    const ellipseCount = (svg.match(/<ellipse/g) || []).length;
    const totalElements = pathCount + circleCount + rectCount + lineCount + polygonCount + ellipseCount;
    
    const elementParts: string[] = [];
    if (pathCount) elementParts.push(`${pathCount} path`);
    if (circleCount) elementParts.push(`${circleCount} circle`);
    if (rectCount) elementParts.push(`${rectCount} rect`);
    if (lineCount) elementParts.push(`${lineCount} line`);
    if (polygonCount) elementParts.push(`${polygonCount} polygon`);
    if (ellipseCount) elementParts.push(`${ellipseCount} ellipse`);
    const elementsStr = elementParts.join(', ') || 'none';
    
    const hasGradient = /<(linearGradient|radialGradient)/i.test(svg);
    const hasFilter = /<filter/i.test(svg);
    const hasClipPath = /<clipPath/i.test(svg);
    const hasMask = /<mask/i.test(svg);
    const features = [hasGradient ? 'gradient' : '', hasFilter ? 'filter' : '', hasClipPath ? 'clipPath' : '', hasMask ? 'mask' : ''].filter(Boolean);

    const fileName = location ? location.file.split(/[/\\]/).pop() : '';

    let displaySvg = svg;
    if (!svg.includes('width=') && !svg.includes('style=')) {
      displaySvg = svg.replace('<svg', '<svg width="100%" height="100%"');
    }

    // Extract colors from SVG for color picker
    const colorRegex = /(fill|stroke|stop-color)=["']([^"']+)["']/gi;
    const styleColorRegex = /(fill|stroke|stop-color)\s*:\s*([^;"'\s]+)/gi;
    const colorsSet = new Set<string>();
    const specialColors = new Set<string>(); // currentColor, none, etc.
    
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
      --font-ui: var(--vscode-font-family, system-ui, sans-serif);
    }
    
    body {
      font-family: var(--font-ui);
      font-size: 13px;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
      line-height: 1.5;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
    }
    
    /* Header */
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 28px;
      padding: 16px 20px;
      background: linear-gradient(135deg, var(--vscode-sideBar-background), transparent);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
    }
    
    .icon-name {
      font-size: 22px;
      font-weight: 700;
      font-family: var(--font-mono);
      background: linear-gradient(135deg, var(--vscode-foreground), var(--vscode-descriptionForeground));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .badge {
      font-size: 10px;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .badge.built {
      color: #73c991;
      border: 1px solid rgba(115, 201, 145, 0.5);
      background: rgba(115, 201, 145, 0.15);
    }
    
    .badge.draft {
      color: #cca652;
      border: 1px solid rgba(204, 166, 82, 0.5);
      background: rgba(204, 166, 82, 0.15);
    }
    
    /* Layout */
    .content {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 32px;
    }
    
    /* Preview */
    .preview-section {
      position: sticky;
      top: 20px;
    }
    
    .preview-container {
      position: relative;
      margin-bottom: 16px;
    }
    
    .preview-box {
      --checker-size: 12px;
      --checker-color: rgba(128, 128, 128, 0.08);
      width: 240px;
      height: 240px;
      background-color: var(--vscode-editor-background);
      background-image: 
        linear-gradient(45deg, var(--checker-color) 25%, transparent 25%),
        linear-gradient(-45deg, var(--checker-color) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, var(--checker-color) 75%),
        linear-gradient(-45deg, transparent 75%, var(--checker-color) 75%);
      background-size: calc(var(--checker-size) * 2) calc(var(--checker-size) * 2);
      background-position: 0 0, 0 var(--checker-size), var(--checker-size) calc(var(--checker-size) * -1), calc(var(--checker-size) * -1) 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    
    .preview-box svg {
      width: 140px;
      height: 140px;
      transition: transform 0.2s ease;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
    }
    
    .preview-box.zoom-1 svg { transform: scale(0.5); }
    .preview-box.zoom-2 svg { transform: scale(0.75); }
    .preview-box.zoom-3 svg { transform: scale(1); }
    .preview-box.zoom-4 svg { transform: scale(1.5); }
    .preview-box.zoom-5 svg { transform: scale(2); }
    
    /* Zoom Controls */
    .zoom-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 14px;
      padding: 8px;
      background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
    }
    
    .zoom-btn {
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
      font-size: 14px;
      transition: all 0.15s ease;
    }
    
    .zoom-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: scale(1.1);
    }
    
    .zoom-level {
      min-width: 55px;
      text-align: center;
      font-size: 12px;
      font-family: var(--font-mono);
      color: var(--vscode-foreground);
      font-weight: 600;
      padding: 4px 8px;
      background: var(--vscode-input-background);
      border-radius: 4px;
    }
    
    /* Color Picker */
    .color-picker-section {
      margin-top: 16px;
      padding: 14px;
      background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
    }
    
    .color-picker-title {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }
    
    .color-swatches {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    
    .current-color-info {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: var(--vscode-inputValidation-infoBackground);
      border: 1px solid var(--vscode-inputValidation-infoBorder);
      border-radius: 4px;
      font-size: 12px;
      width: 100%;
      margin-bottom: 4px;
    }
    
    .current-color-info code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--font-mono);
      font-size: 11px;
    }
    
    .color-hint {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      margin-left: auto;
    }
    
    .color-swatch-view {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      border: 2px solid var(--vscode-panel-border);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.15s ease;
    }
    
    .color-swatch-view:hover {
      transform: scale(1.1);
    }
    
    .no-colors {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    
    .btn-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .btn-success {
      background: rgba(115, 201, 145, 0.2);
      color: #73c991;
      border: 1px solid rgba(115, 201, 145, 0.3);
    }

    .btn-success:hover {
      background: rgba(115, 201, 145, 0.3);
    }

    /* Quick Actions (icon buttons) */
    .quick-actions {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 16px;
    }

    .action-btn {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      cursor: pointer;
      font-size: 16px;
      transition: all 0.15s ease;
    }

    .action-btn:hover {
      background: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .action-btn.action-primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: transparent;
    }

    .action-btn.action-primary:hover {
      background: var(--vscode-button-hoverBackground);
    }

    /* Details */
    .details-section h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 18px;
      color: var(--vscode-foreground);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .details-section h2::before {
      content: '';
      width: 3px;
      height: 18px;
      background: var(--vscode-button-background);
      border-radius: 2px;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 14px;
      margin-bottom: 28px;
    }
    
    .detail-card {
      background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 14px;
      transition: all 0.15s ease;
    }
    
    .detail-card.clickable {
      cursor: pointer;
    }
    
    .detail-card.clickable:hover {
      background: var(--vscode-list-hoverBackground);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .detail-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .detail-value {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--vscode-foreground);
      word-break: break-all;
    }
    
    .detail-sub {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
    }
    
    /* Features */
    .features {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    .feature-tag {
      font-size: 11px;
      padding: 2px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
    }
    
    /* Usages */
    .usages-section {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    
    .usages-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    
    .usages-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .usages-header h2::before {
      content: '';
      width: 3px;
      height: 18px;
      background: var(--vscode-textLink-foreground);
      border-radius: 2px;
    }
    
    .usages-count {
      font-size: 12px;
      padding: 4px 10px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 12px;
      font-weight: 600;
    }
    
    .usages-list {
      background: linear-gradient(135deg, var(--vscode-sideBar-background), var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 10px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .usage-item {
      padding: 14px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    
    .usage-item:last-child {
      border-bottom: none;
    }
    
    .usage-item:hover {
      background: var(--vscode-list-hoverBackground);
      padding-left: 20px;
    }
    
    .usage-file {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--vscode-textLink-foreground);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .usage-file::before {
      content: '\\eb68';
      font-family: codicon;
      font-size: 14px;
      opacity: 0.7;
    }
    
    .usage-preview {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding-left: 22px;
      opacity: 0.8;
    }
    
    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: var(--vscode-descriptionForeground);
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .loading .codicon {
      animation: spin 1s linear infinite;
    }
    
    .empty-state {
      padding: 24px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    
    /* Variants Section */
    .Variants-section {
      margin-top: 28px;
      padding-top: 24px;
      border-top: 1px solid var(--vscode-panel-border);
    }
    
    .Variants-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    
    .Variants-header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .Variants-header h2::before {
      content: '';
      width: 3px;
      height: 18px;
      background: var(--vscode-charts-purple);
      border-radius: 2px;
    }
    
    .Variants-container {
      display: flex;
      flex-wrap: wrap;
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
      transform: translateY(-1px);
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
    }
    
    .variant-item:hover .variant-actions {
      opacity: 1;
    }
    
    .variant-delete, .variant-set-default {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 2px;
      transition: all 0.2s;
      font-size: 10px;
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
    
    .variant-add-btn {
      background: none;
      border: none;
      color: var(--vscode-descriptionForeground);
      cursor: pointer;
      padding: 4px;
      transition: all 0.2s;
    }
    
    .variant-add-btn:hover {
      color: var(--vscode-button-background);
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <span class="icon-name">${name}</span>
      ${isBuilt !== undefined ? `<span class="badge ${isBuilt ? 'built' : 'draft'}">${isBuilt ? 'Built' : 'Draft'}</span>` : ''}
    </header>
    
    <div class="content">
      <div class="preview-section">
        <div class="preview-container">
          <div class="preview-box zoom-3" id="previewBox">
            ${displaySvg}
          </div>
        </div>
        
        <!-- Zoom Controls -->
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
        </div>
        
        <div class="quick-actions">
          <button class="action-btn" onclick="copyName()" title="Copy icon name">
            <span class="codicon codicon-copy"></span>
          </button>
          <button class="action-btn" onclick="copySvg()" title="Copy SVG code">
            <span class="codicon codicon-code"></span>
          </button>
          ${location ? `
          <button class="action-btn" onclick="goToLocation()" title="Go to source">
            <span class="codicon codicon-go-to-file"></span>
          </button>
          ` : ''}
        </div>
        
        <!-- Colors (view only) -->
        <div class="color-picker-section">
          <div class="color-picker-title">
            <span class="codicon codicon-symbol-color"></span> Colors
          </div>
          <div class="color-swatches" id="colorSwatches">
            ${hasCurrentColor ? `
              <div class="current-color-info">
                <span class="codicon codicon-paintcan"></span>
                <span>Uses <code>currentColor</code></span>
                <span class="color-hint">(inherits from CSS)</span>
              </div>
            ` : ''}
            ${svgColors.length > 0 ? svgColors.map(color => `
              <div class="color-swatch-view" style="background-color: ${color}" title="${color}"></div>
            `).join('') : (!hasCurrentColor ? '<span class="no-colors">No colors detected</span>' : '')}
          </div>
        </div>
      </div>
      
      <div class="details-section">
        <h2>Properties</h2>
        <div class="details-grid">
          <div class="detail-card">
            <div class="detail-label">
              <span class="codicon codicon-symbol-ruler"></span> viewBox
            </div>
            <div class="detail-value">${viewBox}</div>
          </div>
          
          ${dimensions ? `
          <div class="detail-card">
            <div class="detail-label">
              <span class="codicon codicon-screen-full"></span> Dimensions
            </div>
            <div class="detail-value">${dimensions}</div>
          </div>
          ` : ''}
          
          <div class="detail-card">
            <div class="detail-label">
              <span class="codicon codicon-file-code"></span> File Size
            </div>
            <div class="detail-value" id="fileSize">${fileSizeStr}</div>
          </div>
          
          <div class="detail-card">
            <div class="detail-label">
              <span class="codicon codicon-symbol-class"></span> Elements
            </div>
            <div class="detail-value">${totalElements}</div>
            <div class="detail-sub">${elementsStr}</div>
          </div>
          
          ${features.length > 0 ? `
          <div class="detail-card" style="grid-column: span 2">
            <div class="detail-label">
              <span class="codicon codicon-extensions"></span> Features
            </div>
            <div class="features">
              ${features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
            </div>
          </div>
          ` : ''}
          
          ${location ? `
          <div class="detail-card clickable" style="grid-column: span 2" onclick="goToLocation()">
            <div class="detail-label">
              <span class="codicon codicon-go-to-file"></span> Source Location
            </div>
            <div class="detail-value">${fileName}:${location.line}</div>
            <div class="detail-sub">${location.file}</div>
          </div>
          ` : ''}
        </div>
        
        <!-- Variants Section -->
        <div class="Variants-section">
          <div class="Variants-header">
            <h2><span class="codicon codicon-color-mode"></span> Variants</h2>
            <button class="variant-add-btn" onclick="saveVariant()" title="Save current colors as variant">
              <span class="codicon codicon-add"></span>
            </button>
          </div>
          <div class="Variants-container" id="VariantsContainer">
            ${this._generateVariantsHtml(name)}
          </div>
        </div>
        
        <div class="usages-section">
          <div class="usages-header">
            <h2><span class="codicon codicon-references"></span> Usages</h2>
            <span class="usages-count" id="usagesCount"></span>
          </div>
          <div class="usages-list" id="usagesList">
            <div class="loading">
              <span class="codicon codicon-sync"></span> Searching for usages...
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    
    // State
    let currentZoom = 3;
    let optimizedSvg = null;
    const zoomLevels = [50, 75, 100, 150, 200];
    
    // Zoom functions
    function updateZoom() {
      const previewBox = document.getElementById('previewBox');
      const zoomLevel = document.getElementById('zoomLevel');
      
      previewBox.className = 'preview-box zoom-' + currentZoom;
      zoomLevel.textContent = zoomLevels[currentZoom - 1] + '%';
    }
    
    function zoomIn() {
      if (currentZoom < 5) {
        currentZoom++;
        updateZoom();
      }
    }
    
    function zoomOut() {
      if (currentZoom > 1) {
        currentZoom--;
        updateZoom();
      }
    }
    
    function resetZoom() {
      currentZoom = 3;
      updateZoom();
    }
    
    // Copy functions
    function copyName() {
      vscode.postMessage({ command: 'copyName' });
    }
    
    function copySvg() {
      const svg = document.querySelector('.preview-box svg');
      vscode.postMessage({ command: 'copySvg', svg: svg?.outerHTML });
    }
    
    // Save function
    function saveSvg() {
      const svg = document.querySelector('.preview-box svg');
      if (svg) {
        vscode.postMessage({ command: 'saveSvg', svg: svg.outerHTML });
      }
    }
    
    // Color picker
    function changeColor(oldColor, newColor) {
      vscode.postMessage({ command: 'changeColor', oldColor, newColor });
    }
    
    function addColor() {
      // Create a color input and trigger it
      const input = document.createElement('input');
      input.type = 'color';
      input.value = '#000000';
      input.style.display = 'none';
      document.body.appendChild(input);
      
      input.addEventListener('change', () => {
        vscode.postMessage({ command: 'addColorToSvg', color: input.value });
        document.body.removeChild(input);
      });
      
      input.click();
    }
    
    // Optimization functions
    function optimizeSvg(preset) {
      // Update button states
      document.querySelectorAll('.optimize-preset').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      
      vscode.postMessage({ command: 'optimizeSvg', preset });
    }
    
    // Variants functionality
    function applyDefaultVariant() {
      vscode.postMessage({ command: 'applyDefaultVariant' });
    }
    
    function applyVariant(index) {
      vscode.postMessage({ command: 'applyVariant', index: index });
    }
    
    function saveVariant() {
      vscode.postMessage({ command: 'saveVariant' });
    }
    
    function deleteVariant(index) {
      vscode.postMessage({ command: 'deleteVariant', index: index });
    }
    
    function setDefaultVariant(variantName) {
      vscode.postMessage({ command: 'setDefaultVariant', variantName: variantName });
    }
    
    function applyOptimizedSvg() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'applyOptimizedSvg', svg: optimizedSvg });
        
        // Update preview
        const previewBox = document.getElementById('previewBox');
        previewBox.innerHTML = optimizedSvg;
        
        // Update file size display
        const size = new Blob([optimizedSvg]).size;
        const sizeStr = size < 1024 ? size + ' B' : (size / 1024).toFixed(1) + ' KB';
        document.getElementById('fileSize').textContent = sizeStr;
      }
    }
    
    function copyOptimizedSvg() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'copySvg', svg: optimizedSvg });
      }
    }
    
    // Navigation
    function goToLocation() {
      vscode.postMessage({ command: 'goToLocation' });
    }
    
    function goToUsage(file, line) {
      vscode.postMessage({ command: 'goToUsage', file, line });
    }
    
    // Auto-search usages on load
    vscode.postMessage({ command: 'findUsages' });
    
    // Message handler
    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'usagesResult') {
        const countEl = document.getElementById('usagesCount');
        const listEl = document.getElementById('usagesList');
        
        countEl.textContent = message.total + ' found';
        
        if (message.usages.length === 0) {
          listEl.innerHTML = '<div class="empty-state"><span class="codicon codicon-info"></span> No usages found in workspace</div>';
        } else {
          listEl.innerHTML = message.usages.map(u => {
            const shortFile = u.file.split(/[\\\\/]/).slice(-3).join('/');
            return \`
              <div class="usage-item" onclick="goToUsage('\${u.file.replace(/\\\\/g, '\\\\\\\\')}', \${u.line})">
                <div class="usage-file">\${shortFile}:\${u.line}</div>
                <div class="usage-preview">\${u.preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              </div>
            \`;
          }).join('');
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
      }
      
      if (message.command === 'colorChanged') {
        // Update preview with new SVG
        const previewBox = document.getElementById('previewBox');
        previewBox.innerHTML = message.svg;
      }
    });
  </script>
</body>
</html>`;
  }

  private _toHexColor(color: string): string {
    // Convert color to hex format for color input
    if (color.startsWith('#')) {
      // Handle 3-digit hex
      if (color.length === 4) {
        return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
      }
      return color;
    }
    
    // Handle rgb/rgba
    const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0');
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0');
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0');
      return '#' + r + g + b;
    }
    
    // Handle named colors (basic ones)
    const namedColors: Record<string, string> = {
      'black': '#000000', 'white': '#ffffff', 'red': '#ff0000',
      'green': '#008000', 'blue': '#0000ff', 'yellow': '#ffff00',
      'cyan': '#00ffff', 'magenta': '#ff00ff', 'gray': '#808080',
      'grey': '#808080', 'orange': '#ffa500', 'purple': '#800080',
      'pink': '#ffc0cb', 'brown': '#a52a2a', 'navy': '#000080',
      'teal': '#008080', 'lime': '#00ff00', 'aqua': '#00ffff',
      'maroon': '#800000', 'olive': '#808000', 'silver': '#c0c0c0',
      'currentcolor': '#000000'
    };
    
    return namedColors[color.toLowerCase()] || '#000000';
  }

  private _generateVariantsHtml(iconName: string): string {
    const savedVariants = this._getSavedVariants(iconName);
    const defaultVariant = this._getDefaultVariant(iconName);
    
    // Original variant item (always present)
    const originalVariant = `
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
    `;
    
    // Saved Variants
    const savedVariantsHtml = savedVariants.map((variant, index) => `
      <div class="variant-item${this._selectedVariantIndex === index ? ' selected' : ''}${defaultVariant === variant.name ? ' is-default' : ''}" onclick="applyVariant(${index})" title="${variant.name} - Click to apply${defaultVariant === variant.name ? ' (active default)' : ''}">
        <div class="variant-colors">
          ${variant.colors.slice(0, 4).map(c => `<div class="variant-color-dot" style="background:${c}"></div>`).join('')}
        </div>
        <span class="variant-name">${variant.name}</span>
        <div class="variant-actions">
          <button class="variant-set-default${defaultVariant === variant.name ? ' active' : ''}" onclick="event.stopPropagation(); setDefaultVariant('${variant.name}')" title="${defaultVariant === variant.name ? 'Currently default' : 'Set as default'}">
            <span class="codicon codicon-star${defaultVariant === variant.name ? '-full' : '-empty'}"></span>
          </button>
          <button class="variant-delete" onclick="event.stopPropagation(); deleteVariant(${index})" title="Delete">
            <span class="codicon codicon-trash"></span>
          </button>
        </div>
      </div>
    `).join('');
    
    return originalVariant + savedVariantsHtml;
  }
}
