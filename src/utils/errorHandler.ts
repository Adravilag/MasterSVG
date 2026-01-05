import * as vscode from 'vscode';

export class ErrorHandler {
  /**
   * Handles an error by logging it to the console and showing an error message to the user.
   * @param error The error object or message.
   * @param context A description of what was happening when the error occurred.
   * @param showNotification Whether to show a VS Code notification (default: true).
   */
  public static handleError(
    error: unknown,
    context: string,
    showNotification: boolean = true
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = `MasterSVG: Error during ${context}: ${errorMessage}`;

    console.error(fullMessage);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    if (showNotification) {
      vscode.window.showErrorMessage(`MasterSVG: ${errorMessage}`);
    }
  }

  /**
   * Wraps an async operation with error handling.
   * @param operation The async function to execute.
   * @param contextDescription A description of the operation for the error message.
   * @returns The result of the operation, or undefined if it failed.
   */
  public static async wrapAsync<T>(
    operation: () => Promise<T>,
    contextDescription: string
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error, contextDescription);
      return undefined;
    }
  }

  /**
   * Wraps a synchronous operation with error handling.
   * @param operation The function to execute.
   * @param contextDescription A description of the operation for the error message.
   * @returns The result of the operation, or undefined if it failed.
   */
  public static wrapSync<T>(operation: () => T, contextDescription: string): T | undefined {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, contextDescription);
      return undefined;
    }
  }
}
