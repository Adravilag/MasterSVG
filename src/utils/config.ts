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
