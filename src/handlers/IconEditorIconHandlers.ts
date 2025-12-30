import * as vscode from 'vscode';
import { t } from '../i18n';
import { getAnimationService } from '../services/AnimationAssignmentService';

/**
 * Icon location data
 */
interface IconLocation {
  file: string;
  line: number;
}

/**
 * Context passed to icon handlers
 */
export interface IconHandlerContext {
  iconData: {
    name: string;
    svg: string;
    location?: IconLocation;
  } | undefined;
  panel: vscode.WebviewPanel;
  postMessage: (message: unknown) => void;
  updateIconName: (name: string) => void;
  updateIconLocation: (file: string) => void;
  refresh: () => void;
  addToIconCollection: (animation?: string, animationSettings?: unknown) => Promise<void>;
}

/**
 * Handle rename request (shows input box)
 */
export async function handleRequestRename(
  ctx: IconHandlerContext,
  message: { currentName?: string }
): Promise<void> {
  if (!ctx.iconData || !message.currentName) return;

  const newName = await vscode.window.showInputBox({
    prompt: t('editor.renamePrompt'),
    value: message.currentName,
    placeHolder: 'icon-name',
    validateInput: (value) => {
      if (!value || value.trim() === '') {
        return t('editor.nameCannotBeEmpty');
      }
      if (value === message.currentName) {
        return t('editor.enterDifferentName');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return t('editor.nameValidation');
      }
      return undefined;
    }
  });

  if (newName) {
    try {
      const result = await vscode.commands.executeCommand<{ newName: string; newPath?: string } | undefined>(
        'iconManager.renameIcon',
        {
          icon: {
            name: message.currentName,
            path: ctx.iconData.location?.file,
            svg: ctx.iconData.svg
          },
          contextValue: ctx.iconData.location ? 'svgIcon' : 'builtIcon'
        },
        newName
      );

      if (result) {
        ctx.updateIconName(result.newName);

        if (result.newPath && ctx.iconData.location) {
          ctx.updateIconLocation(result.newPath);
        }

        ctx.panel.title = `${t('editor.edit')}: ${result.newName}`;
        ctx.postMessage({ command: 'nameUpdated', newName: result.newName });
        vscode.window.showInformationMessage(t('messages.renamedTo', { name: result.newName }));

        vscode.commands.executeCommand(
          'iconManager.revealInTree',
          result.newName,
          result.newPath || ctx.iconData.location?.file,
          ctx.iconData.location?.line
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(t('messages.errorRenaming', { error: String(error) }));
    }
  }
}

/**
 * Handle rename icon command
 */
export async function handleRenameIcon(
  ctx: IconHandlerContext,
  message: { oldName?: string; newName?: string }
): Promise<void> {
  if (!ctx.iconData || !message.oldName || !message.newName) return;

  try {
    const result = await vscode.commands.executeCommand<{ newName: string; newPath?: string } | undefined>(
      'iconManager.renameIcon',
      {
        icon: {
          name: message.oldName,
          path: ctx.iconData.location?.file,
          svg: ctx.iconData.svg
        },
        contextValue: ctx.iconData.location ? 'svgIcon' : 'builtIcon'
      },
      message.newName
    );

    if (result) {
      ctx.updateIconName(result.newName);

      if (result.newPath && ctx.iconData.location) {
        ctx.updateIconLocation(result.newPath);
      }

      ctx.panel.title = `${t('editor.edit')}: ${result.newName}`;
      ctx.refresh();
      vscode.window.showInformationMessage(t('messages.renamedTo', { name: result.newName }));

      vscode.commands.executeCommand(
        'iconManager.revealInTree',
        result.newName,
        result.newPath || ctx.iconData.location?.file,
        ctx.iconData.location?.line
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(t('messages.errorRenaming', { error: String(error) }));
  }
}

/**
 * Handle rebuild (add to icon collection)
 */
export async function handleRebuild(
  ctx: IconHandlerContext,
  message: { 
    animation?: string; 
    animationSettings?: Record<string, unknown>;
    applyOptimization?: boolean;
  }
): Promise<void> {
  if (!ctx.iconData?.svg) return;

  // If optimization is pending, apply it first via command
  if (message.applyOptimization) {
    ctx.postMessage({ command: 'applyOptimizationBeforeRebuild' });
  }
  
  await ctx.addToIconCollection(message.animation, message.animationSettings);
}

/**
 * Handle saving animation assignment for an icon
 */
export function handleSaveAnimation(
  ctx: IconHandlerContext,
  message: { animation?: string; settings?: Record<string, unknown> }
): void {
  if (!ctx.iconData?.name) return;
  
  const animService = getAnimationService();
  const animationType = message.animation || 'none';
  
  if (animationType === 'none') {
    animService.removeAnimation(ctx.iconData.name);
    vscode.window.showInformationMessage(t('messages.animationRemoved', { name: ctx.iconData.name }));
  } else {
    animService.setAnimation(ctx.iconData.name, {
      type: animationType,
      duration: message.settings?.duration as number | undefined,
      timing: message.settings?.timing as string | undefined,
      iteration: message.settings?.iteration as string | undefined,
      delay: message.settings?.delay as number | undefined,
      direction: message.settings?.direction as string | undefined
    });
    vscode.window.showInformationMessage(t('messages.animationSaved', { name: ctx.iconData.name, animation: animationType }));
  }
}

/**
 * Handle refresh icons command
 */
export function handleRefresh(): void {
  vscode.commands.executeCommand('iconManager.refreshIcons');
}

