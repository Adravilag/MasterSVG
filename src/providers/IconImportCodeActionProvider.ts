import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getComponentExporter } from '../services';

export class IconImportCodeActionProvider implements vscode.CodeActionProvider {
  public static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection): vscode.CodeAction[] | undefined {
    const line = document.lineAt(range.start.line).text;

    // Simple heuristic: look for JSX self-closing tags like <Icon ... /> or <IconName ... />
    const tagMatch = line.match(/<([A-Z][A-Za-z0-9_]*)\b/);
    if (!tagMatch) return;

    const componentName = tagMatch[1];

    // If component is already declared/imported in document, skip
    const importRegex = new RegExp(`import\\s+(?:\\{[^}]*\\}|\\w+)\\s+from\\s+['\"][^'\"]*${componentName}['\"]`);
    if (importRegex.test(document.getText())) return;

    // Build quick fix action
    const fixes: vscode.CodeAction[] = [];

    // Quick fix: only add import
    const importFix = new vscode.CodeAction(`Importar icono: "${componentName}"`, vscode.CodeActionKind.QuickFix);
    importFix.isPreferred = true;
    const importEdit = new vscode.WorkspaceEdit();

    // Determine workspace icons index vs direct import
    const workspaceFolders = vscode.workspace.workspaceFolders;
    let importText = `import ${componentName} from './icons/${componentName}';\n`;

    let outDir = '';
    if (workspaceFolders && workspaceFolders.length > 0) {
      outDir = path.join(workspaceFolders[0].uri.fsPath, 'icons');
      const indexPath = path.join(outDir, 'index.ts');
      if (fs.existsSync(indexPath)) {
        importText = `import { ${componentName} } from './icons';\n`;
      }
    }

    // Insert import at top of file (after existing imports if any)
    let insertPos = new vscode.Position(0, 0);
    const text = document.getText();
    const importSection = text.match(/^(?:\s*import[\s\S]*?from .*?;\s*)+/m);
    if (importSection && importSection.index !== undefined) {
      const imports = importSection[0];
      const lines = imports.split(/\r?\n/).length;
      insertPos = new vscode.Position(lines, 0);
    }

    importEdit.insert(document.uri, insertPos, importText);
    importFix.edit = importEdit;
    fixes.push(importFix);

    // Quick fix: create icon file + import
    const createFix = new vscode.CodeAction(`Crear icono '${componentName}' y añadir import`, vscode.CodeActionKind.QuickFix);
    const createEdit = new vscode.WorkspaceEdit();

    try {
      if (outDir) {
        if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

        // Generate TSX using ComponentExporter
        const exporter = getComponentExporter();
        const exportResult = exporter.export({
          format: 'react',
          iconName: componentName,
          svg: `<svg viewBox="0 0 24 24"><rect width=\"24\" height=\"24\"/></svg>`,
          typescript: true,
          memo: false,
          forwardRef: false,
        });

        const componentPath = path.join(outDir, exportResult.filename);
        // Write file if not exists
        if (!fs.existsSync(componentPath)) {
          fs.writeFileSync(componentPath, exportResult.code, 'utf-8');
        }

        // Ensure types.d.ts exists
        const typesPath = path.join(outDir, 'types.d.ts');
        if (!fs.existsSync(typesPath)) {
          fs.writeFileSync(
            typesPath,
            `/** Types and usage for generated icons (created by MasterSVG) */\nimport * as React from 'react';\n\nexport interface IconProps extends React.SVGProps<SVGSVGElement> {\n  size?: number | string;\n  color?: string;\n}\n`,
            'utf-8'
          );
        }

        // Recreate index.ts to export all icons
        const files = fs.readdirSync(outDir).filter(f => f.endsWith('.tsx'));
        const indexPath = path.join(outDir, 'index.ts');
        const exportLines = files.map(f => {
          const name = f.replace(/\.tsx$/, '');
          return `export { default as ${name} } from './${name}';`;
        });
        fs.writeFileSync(indexPath, exportLines.join('\n') + '\n', 'utf-8');

        // Prepare import insertion in current document
        if (fs.existsSync(indexPath)) {
          importText = `import { ${componentName} } from './icons';\n`;
        } else {
          importText = `import ${componentName} from './icons/${componentName}';\n`;
        }

        createEdit.insert(document.uri, insertPos, importText);
        createFix.edit = createEdit;
        fixes.push(createFix);

        // Notify user that files were created
        try {
          vscode.window.showInformationMessage(`Icono '${componentName}' creado en carpeta icons/`);
        } catch (e) {
          // ignore notification errors in tests
        }
      }
    } catch (e) {
      // ignore generation errors and do not add create fix
    }

    return fixes;
  }

  // Metadata
  public static metadata: vscode.CodeActionProviderMetadata = {
    providedCodeActionKinds: IconImportCodeActionProvider.providedCodeActionKinds,
  };
}

export default IconImportCodeActionProvider;
