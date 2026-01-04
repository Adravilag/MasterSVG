import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Cached ignore patterns
let ignorePatterns: string[] = [];
let ignoreFileWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Read and parse .sageboxignore file
 * Supports gitignore-like patterns:
 * - Lines starting with # are comments
 * - Empty lines are ignored
 * - Patterns can use * and ** wildcards
 * - Patterns starting with / are relative to workspace root
 * - Patterns ending with / match directories
 */
function loadIgnorePatterns(): string[] {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return [];

  const ignoreFile = path.join(workspaceRoot, '.sageboxignore');

  if (!fs.existsSync(ignoreFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(ignoreFile, 'utf-8');
    const patterns = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    return patterns;
  } catch {
    return [];
  }
}

/**
 * Check if a path should be ignored based on .sageboxignore patterns
 * @param filePath Absolute path to check
 * @returns true if the path should be ignored
 */
export function shouldIgnorePath(filePath: string): boolean {
  if (ignorePatterns.length === 0) return false;

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return false;

  // Get relative path from workspace root
  const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');

  for (const pattern of ignorePatterns) {
    if (matchIgnorePattern(relativePath, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Match a relative path against a gitignore-like pattern
 */
function matchIgnorePattern(relativePath: string, pattern: string): boolean {
  // Normalize pattern
  let normalizedPattern = pattern.replace(/\\/g, '/');

  // Handle directory patterns (ending with /)
  const isDirectoryPattern = normalizedPattern.endsWith('/');
  if (isDirectoryPattern) {
    normalizedPattern = normalizedPattern.slice(0, -1);
  }

  // Handle patterns starting with / (root-relative)
  const isRootRelative = normalizedPattern.startsWith('/');
  if (isRootRelative) {
    normalizedPattern = normalizedPattern.slice(1);
  }

  // Convert glob pattern to regex
  const regexPattern = normalizedPattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{DOUBLESTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/{{DOUBLESTAR}}/g, '.*')
    .replace(/\?/g, '[^/]');

  // Build the final regex
  let regex: RegExp;
  if (isRootRelative) {
    // Match from start
    regex = new RegExp(`^${regexPattern}(?:/|$)`);
  } else if (isDirectoryPattern) {
    // Match directory anywhere in path
    regex = new RegExp(`(?:^|/)${regexPattern}(?:/|$)`);
  } else {
    // Match anywhere in path (file or directory)
    regex = new RegExp(`(?:^|/)${regexPattern}(?:/|$)|^${regexPattern}$`);
  }

  return regex.test(relativePath);
}

/**
 * Initialize the .sageboxignore file watcher
 */
export function initIgnoreFileWatcher(context: vscode.ExtensionContext): void {
  // Load initial patterns
  ignorePatterns = loadIgnorePatterns();

  // Watch for changes to .sageboxignore
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceRoot) {
    ignoreFileWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceRoot, '.sageboxignore')
    );

    const reloadPatterns = () => {
      ignorePatterns = loadIgnorePatterns();
      // Fire event to refresh tree (will be handled by the provider)
      vscode.commands.executeCommand('sageboxIconStudio.refresh');
    };

    ignoreFileWatcher.onDidCreate(reloadPatterns);
    ignoreFileWatcher.onDidChange(reloadPatterns);
    ignoreFileWatcher.onDidDelete(reloadPatterns);

    context.subscriptions.push(ignoreFileWatcher);
  }
}

// Export for testing
export { matchIgnorePattern, loadIgnorePatterns };

/**
 * Force reload of ignore patterns
 */
export function reloadIgnorePatterns(): void {
  ignorePatterns = loadIgnorePatterns();
}
