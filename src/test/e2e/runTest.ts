/**
 * E2E Test Runner
 * Launches VS Code with the extension and runs e2e tests
 */

import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // The test workspace folder
    const testWorkspacePath = path.resolve(__dirname, './test-workspace');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspacePath, // Open test workspace
        '--disable-extensions', // Disable other extensions for clean tests
        '--disable-gpu',
      ],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
