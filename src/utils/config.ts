import * as vscode from 'vscode';

/**
 * Get a configuration value from the Icon Manager extension settings
 * @param key The configuration key (without the 'iconManager.' prefix)
 * @param defaultValue The default value if the configuration is not set
 * @returns The configuration value
 */
export function getSvgConfig<T>(key: string, defaultValue: T): T {
  const config = vscode.workspace.getConfiguration('iconManager');
  return config.get<T>(key, defaultValue);
}

/**
 * Get the full Icon Manager configuration object
 * @returns The full configuration object
 */
export function getFullSvgConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('iconManager');
}

/**
 * Update a configuration value
 * @param key The configuration key (without the 'iconManager.' prefix)
 * @param value The new value
 * @param global Whether to update globally or for the workspace
 */
export async function updateSvgConfig<T>(
  key: string,
  value: T,
  global: boolean = false
): Promise<void> {
  const config = vscode.workspace.getConfiguration('iconManager');
  await config.update(key, value, global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace);
}

/**
 * Check if Icon Studio is fully configured (all 4 steps completed)
 * Step 1: Source directory (svgFolders)
 * Step 2: Output directory (outputDirectory)
 * Step 3: Build format (buildFormat)
 * Step 4: Web component name (webComponentName with hyphen)
 * @returns true if all configuration steps are complete
 */
export function isFullyConfigured(): boolean {
  const config = vscode.workspace.getConfiguration('iconManager');
  
  const svgFolders = config.get<string[]>('svgFolders', []);
  const outputDirectory = config.get<string>('outputDirectory', '');
  const buildFormat = config.get<string>('buildFormat', '');
  const webComponentName = config.get<string>('webComponentName', '');
  
  const isStep1Complete = svgFolders.length > 0 && svgFolders[0].length > 0;
  const isStep2Complete = !!outputDirectory;
  const isStep3Complete = !!buildFormat;
  const isStep4Complete = webComponentName.includes('-');
  
  return isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
}

