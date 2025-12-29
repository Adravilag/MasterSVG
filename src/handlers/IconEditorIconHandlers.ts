import * as vscode from 'vscode';

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

        ctx.panel.title = `Edit: ${result.newName}`;
        ctx.postMessage({ command: 'nameUpdated', newName: result.newName });
        vscode.window.showInformationMessage(`Renamed to "${result.newName}"`);

        vscode.commands.executeCommand(
          'iconManager.revealInTree',
          result.newName,
          result.newPath || ctx.iconData.location?.file,
          ctx.iconData.location?.line
        );
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error renaming: ${error}`);
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

      ctx.panel.title = `Edit: ${result.newName}`;
      ctx.refresh();
      vscode.window.showInformationMessage(`Renamed to "${result.newName}"`);

      vscode.commands.executeCommand(
        'iconManager.revealInTree',
        result.newName,
        result.newPath || ctx.iconData.location?.file,
        ctx.iconData.location?.line
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error renaming icon: ${error}`);
  }
}

/**
 * Handle rebuild (add to icon collection)
 */
export async function handleRebuild(
  ctx: IconHandlerContext,
  message: { animation?: string; animationSettings?: Record<string, unknown> }
): Promise<void> {
  if (!ctx.iconData?.svg) return;

  await ctx.addToIconCollection(message.animation, message.animationSettings);
}

/**
 * Handle refresh icons command
 */
export function handleRefresh(): void {
  vscode.commands.executeCommand('iconManager.refreshIcons');
}
