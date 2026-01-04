import * as vscode from 'vscode';
import { getVariantsService, AnimationPreset } from '../services/VariantsService';

/**
 * Handle saving a custom animation preset to the icon
 * Animation presets are now stored per-icon in variants.js
 */
export async function handleSaveAnimationPreset(
  message: {
    name?: string;
    settings?: Record<string, unknown>;
    animationType?: string;
    iconName?: string;
  }
): Promise<void> {
  const name = message.name?.trim();
  const animationType = message.animationType || 'none';
  const iconName = message.iconName;
  const settings = message.settings || {};

  if (!name || name.length === 0) {
    vscode.window.showErrorMessage('Por favor ingresa un nombre para la animación');
    return;
  }

  if (name.length > 50) {
    vscode.window.showErrorMessage('El nombre no puede exceder 50 caracteres');
    return;
  }

  if (!iconName) {
    vscode.window.showErrorMessage('Error: No se especificó el icono');
    return;
  }

  try {
    const variantsService = getVariantsService();
    const preset: AnimationPreset = {
      name,
      type: animationType,
      duration: typeof settings.duration === 'number' ? settings.duration : 1,
      timing: typeof settings.timing === 'string' ? settings.timing : 'ease-in-out',
      iteration: typeof settings.iteration === 'string' ? settings.iteration : '1',
      delay: typeof settings.delay === 'number' ? settings.delay : 0,
      direction: typeof settings.direction === 'string' ? settings.direction : 'normal',
    };

    variantsService.saveAnimationPreset(iconName, preset);
    vscode.window.showInformationMessage(`✅ Animación "${name}" guardada exitosamente en "${iconName}"`);
  } catch (error) {
    vscode.window.showErrorMessage(`Error al guardar la animación: ${String(error)}`);
  }
}

/**
 * Handle deleting a custom animation preset from the icon
 */
export async function handleDeleteAnimationPreset(
  message: {
    name?: string;
    iconName?: string;
  }
): Promise<void> {
  const name = message.name?.trim();
  const iconName = message.iconName;

  if (!name || !iconName) return;

  try {
    const variantsService = getVariantsService();
    variantsService.deleteAnimationPreset(iconName, name);
    vscode.window.showInformationMessage(`✅ Animación "${name}" eliminada`);
  } catch (error) {
    vscode.window.showErrorMessage(`Error al eliminar la animación: ${String(error)}`);
  }
}

/**
 * Handle getting all animation presets for the current icon - sends them to webview
 */
export async function handleGetAnimationPresets(
  webview: vscode.Webview,
  iconName: string
): Promise<void> {
  try {
    const variantsService = getVariantsService();
    const presets = variantsService.getAnimationPresets(iconName);

    webview.postMessage({
      command: 'animationPresetsLoaded',
      presets,
    });
  } catch (error) {
    console.error('Error loading animation presets:', error);
  }
}
