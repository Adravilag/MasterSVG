import * as vscode from 'vscode';

/**
 * Get a configuration value from the MasterSVG extension settings
 * @param key The configuration key (without the 'masterSVG.' prefix)
 * @param defaultValue The default value if the configuration is not set
 * @returns The configuration value
 */
export function getSvgConfig<T>(key: string, defaultValue: T): T {
  const config = vscode.workspace.getConfiguration('masterSVG');
  return config.get<T>(key, defaultValue);
}

/**
 * Get the full MasterSVG configuration object
 * @returns The full configuration object
 */
export function getFullSvgConfig(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('masterSVG');
}

/**
 * Update a configuration value
 * @param key The configuration key (without the 'masterSVG.' prefix)
 * @param value The new value
 * @param global Whether to update globally or for the workspace
 */
export async function updateSvgConfig<T>(
  key: string,
  value: T,
  global: boolean = false
): Promise<void> {
  const config = vscode.workspace.getConfiguration('masterSVG');
  await config.update(
    key,
    value,
    global ? vscode.ConfigurationTarget.Global : vscode.ConfigurationTarget.Workspace
  );
}

/**
 * Check if MasterSVG is fully configured (all 4 steps completed)
 * Step 1: Source directory (svgFolders)
 * Step 2: Output directory (outputDirectory)
 * Step 3: Build format (buildFormat)
 * Step 4: Component name (webComponentName - must have hyphen for HTML, any non-empty for others)
 * @returns true if all configuration steps are complete
 */
export function isFullyConfigured(): boolean {
  const config = vscode.workspace.getConfiguration('masterSVG');

  const svgFolders = config.get<string[]>('svgFolders', []);
  const outputDirectory = config.get<string>('outputDirectory', '');
  const buildFormat = config.get<string>('buildFormat', 'icons.js');
  const webComponentName = config.get<string>('webComponentName', '');
  const framework = config.get<string>('framework', 'html');

  const isStep1Complete = svgFolders.length > 0 && svgFolders[0].length > 0;
  const isStep2Complete = !!outputDirectory;
  const isStep3Complete = !!buildFormat;
  // HTML web components require hyphen, other frameworks just need a non-empty name
  const isStep4Complete = framework === 'html'
    ? webComponentName.includes('-')
    : webComponentName.length > 0;

  return isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
}
