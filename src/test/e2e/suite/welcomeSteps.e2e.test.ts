/**
 * Welcome Panel Steps E2E Tests
 * Tests for verifying step completion states and button enablement
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Welcome Panel Steps State Tests', () => {
  
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  // Helper function that replicates WelcomePanel logic for CSS class generation
  // with progressive unlock: each step unlocks when the previous is completed
  function getStepNumberClasses(config: {
    svgFolders: string[];
    outputDirectory: string;
    webComponentName: string;
    buildFormat: string;
    hasBuiltIcons: boolean;
  }) {
    const isSourceConfigured = config.svgFolders.length > 0 && !!config.svgFolders[0];
    const isOutputConfigured = !!config.outputDirectory;
    const isBuildFormatConfigured = !!config.buildFormat;
    // Explicitly convert to boolean to avoid returning empty string ''
    const isWebComponentConfigured = !!(config.webComponentName && config.webComponentName.includes('-'));
    
    // Progressive unlock logic
    const isStep1Complete = isSourceConfigured;
    const isStep2Unlocked = true;
    const isStep2Complete = isOutputConfigured;
    const isStep3Unlocked = true;
    const isStep3Complete = isBuildFormatConfigured;
    const isStep4Unlocked = true;
    const isStep4Complete = !!(isWebComponentConfigured);
    
    // All 4 steps must be complete for button to be enabled
    const isFullyConfigured = !!(isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete);
    
    return {
      step1NumberClass: isStep1Complete ? 'completed' : '',
      step2NumberClass: isStep2Complete ? 'completed' : '',
      step2Disabled: !isStep2Unlocked,
      step3NumberClass: isStep3Complete ? 'completed' : '',
      step3Disabled: !isStep3Unlocked,
      step4NumberClass: isStep4Complete ? 'completed' : '',
      step4Disabled: !isStep4Unlocked,
      isButtonEnabled: isFullyConfigured
    };
  }
  
  // Clean all config before the whole suite
  async function cleanAllConfig() {
    const config = vscode.workspace.getConfiguration('iconManager');
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
    await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
    await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);
    await delay(300);
  }
  
  suiteSetup(async () => {
    // Ensure extension is activated
    const ext = vscode.extensions.getExtension('sagebox.sagebox-icon-studio');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    await delay(1000);
    
    // Clean all config at the start
    await cleanAllConfig();
  });
  
  suiteTeardown(async () => {
    // Clean up all config
    const config = vscode.workspace.getConfiguration('iconManager');
    await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
    await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
    await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
    await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);
    await delay(300);
  });
  
  suite('Step 1 - Source Directory Configuration', () => {
    
    setup(async () => {
      // Clear ALL config before each test
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
      await delay(300);
    });
    
    test('Step 1 has default folders configured in package.json', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      const svgFolders = config.get<string[]>('svgFolders', []);
      
      // package.json defines default folders, so svgFolders is never truly empty
      // Default: ["svgs", "src/assets/icons", "src/icons", "public/icons", "assets/icons", "icons", "svg", "assets/svg"]
      // This means isSourceConfigured is always true with defaults
      const hasDefaultFolders = svgFolders.length > 0;
      assert.strictEqual(hasDefaultFolders, true, 'svgFolders has default values from package.json');
    });
    
    test('Step 1 should be completed when svgFolders has value', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', ['src/icons'], vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      const isSourceConfigured = svgFolders.length > 0 && !!svgFolders[0];
      
      assert.strictEqual(isSourceConfigured, true, 'Step 1 should be completed when has value');
    });
  });
  
  suite('Step 2 - Output Directory Configuration', () => {
    
    setup(async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
      await delay(200);
    });
    
    test('Step 2 should NOT be completed when outputDirectory is empty', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      const outputDir = config.get<string>('outputDirectory', '');
      
      const isOutputConfigured = !!outputDir;
      assert.strictEqual(isOutputConfigured, false, 'Step 2 should NOT be completed when empty');
    });
    
    test('Step 2 should be completed when outputDirectory has value', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('outputDirectory', 'src/icons', vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      const isOutputConfigured = !!outputDir;
      
      assert.strictEqual(isOutputConfigured, true, 'Step 2 should be completed when has value');
    });
  });
  
  suite('Step 3 - Build Format Configuration', () => {
    
    test('Step 3 build format has no default - user must select', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      // Reset to verify no default
      await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const buildFormat = config.get<string>('buildFormat', '');
      
      // buildFormat should be empty until user selects one
      assert.strictEqual(buildFormat, '', 'Build format should be empty until user selects');
    });
    
    test('Step 3 completion requires buildFormat to be selected', async () => {
      // Step 3 is complete only when buildFormat has a value
      // This ensures user actively makes a choice
      const classes = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: '',
        buildFormat: '', // Not selected
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step3NumberClass, '', 
        'Step 3 should NOT be green when buildFormat is empty');
      
      const classesWithFormat = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: '',
        buildFormat: 'icons.ts', // Selected
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesWithFormat.step3NumberClass, 'completed', 
        'Step 3 should be green when buildFormat is selected');
    });
  });
  
  suite('Step 4 - Web Component Name Configuration', () => {
    
    setup(async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
      await delay(200);
    });
    
    test('Step 4 should NOT be completed when name has no hyphen', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('webComponentName', 'myicon', vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      const isWebComponentConfigured = webComponentName && webComponentName.includes('-');
      
      assert.strictEqual(isWebComponentConfigured, false, 'Step 4 should NOT be completed without hyphen');
    });
    
    test('Step 4 should be completed when name has hyphen', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('webComponentName', 'my-icon', vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      const isWebComponentConfigured = webComponentName && webComponentName.includes('-');
      
      assert.strictEqual(!!isWebComponentConfigured, true, 'Step 4 should be completed with hyphen');
    });
    
    test('Step 4 should be completed when sg-icon is explicitly set', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      // sg-icon has no default anymore - user must explicitly set it
      await config.update('webComponentName', 'sg-icon', vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      const isWebComponentConfigured = webComponentName && webComponentName.includes('-');
      
      assert.strictEqual(!!isWebComponentConfigured, true, 'Step 4 should be completed when sg-icon is explicitly set');
    });
    
    test('Step 4 should NOT be completed when webComponentName is empty (no default)', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      const isWebComponentConfigured = webComponentName && webComponentName.includes('-');
      
      assert.strictEqual(!!isWebComponentConfigured, false, 'Step 4 should NOT be completed when empty');
    });
  });
  
  suite('Complete Button Enablement Logic', () => {
    
    setup(async () => {
      // Clear ALL config before each test to ensure clean state
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
      await delay(300);
    });
    
    test('Button should be DISABLED when no configuration', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      const svgFolders = config.get<string[]>('svgFolders', []);
      const outputDir = config.get<string>('outputDirectory', '');
      
      const isSourceConfigured = svgFolders.length > 0 && !!svgFolders[0];
      const isOutputConfigured = !!outputDir;
      const isConfigured = isSourceConfigured && isOutputConfigured;
      
      assert.strictEqual(isConfigured, false, 'Button should be disabled when no config');
    });
    
    test('Button should be DISABLED when only Step 1 is configured', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', ['src/icons'], vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      
      const isSourceConfigured = svgFolders.length > 0 && !!svgFolders[0];
      const isOutputConfigured = !!outputDir;
      const isConfigured = isSourceConfigured && isOutputConfigured;
      
      assert.strictEqual(isConfigured, false, 'Button should be disabled when only Step 1 done');
    });
    
    test('Button disabled logic depends only on outputDirectory (since svgFolders has defaults)', async () => {
      // Since svgFolders has default values in package.json, 
      // the button is effectively disabled only when outputDirectory is empty
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('outputDirectory', 'test-output', vscode.ConfigurationTarget.Global);
      await delay(300);
      
      // Now clear outputDirectory
      await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
      await delay(300);
      
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      const isOutputConfigured = !!outputDir;
      
      // outputDirectory default is empty string, so clearing it disables the button
      assert.strictEqual(isOutputConfigured, false, 'Button should be disabled when outputDirectory is empty');
    });
    
    test('Button should still be DISABLED when only Step 1 AND Step 2 are configured', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', ['src/icons'], vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', 'public/icons', vscode.ConfigurationTarget.Global);
      await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global); // Not selected
      await delay(200);
      
      const svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      const buildFormat = vscode.workspace.getConfiguration('iconManager').get<string>('buildFormat', '');
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      
      const isStep1Complete = svgFolders.length > 0 && !!svgFolders[0];
      const isStep2Complete = isStep1Complete && !!outputDir;
      const isStep3Complete = isStep2Complete && !!buildFormat;
      const isStep4Complete = isStep3Complete && webComponentName.includes('-');
      const isFullyConfigured = isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
      
      assert.strictEqual(isStep1Complete, true, 'Step 1 done');
      assert.strictEqual(isStep2Complete, true, 'Step 2 done');
      assert.strictEqual(isStep3Complete, false, 'Step 3 NOT done (buildFormat empty)');
      assert.strictEqual(isFullyConfigured, false, 'Button DISABLED - need all 4 steps');
    });
    
    test('Button requires ALL 4 steps to be enabled', async () => {
      // Now the button requires all 4 steps to be complete
      
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', ['svgs'], vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', 'output', vscode.ConfigurationTarget.Global);
      await config.update('buildFormat', 'icons.ts', vscode.ConfigurationTarget.Global);
      await config.update('webComponentName', 'my-icon', vscode.ConfigurationTarget.Global);
      await delay(200);
      
      const svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      const buildFormat = vscode.workspace.getConfiguration('iconManager').get<string>('buildFormat', '');
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      
      const isStep1Complete = svgFolders.length > 0 && !!svgFolders[0];
      const isStep2Complete = isStep1Complete && !!outputDir;
      const isStep3Complete = isStep2Complete && !!buildFormat;
      const isStep4Complete = isStep3Complete && webComponentName.includes('-');
      const isFullyConfigured = isStep1Complete && isStep2Complete && isStep3Complete && isStep4Complete;
      
      assert.strictEqual(isFullyConfigured, true, 
        'Button requires all 4 steps complete');
    });
  });
  
  suite('Full Configuration Flow', () => {
    
    test('Complete 4-step configuration flow', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      
      // Step 1: Configure source
      await config.update('svgFolders', ['src/assets/svg'], vscode.ConfigurationTarget.Global);
      await delay(200);
      let svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      let step1Complete = svgFolders.length > 0 && !!svgFolders[0];
      assert.strictEqual(step1Complete, true, 'Step 1 should be complete');
      
      // Step 2: Configure output
      await config.update('outputDirectory', 'src/icons', vscode.ConfigurationTarget.Global);
      await delay(200);
      let outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      let step2Complete = !!outputDir;
      assert.strictEqual(step2Complete, true, 'Step 2 should be complete');
      
      // Step 3: Build format (no default - user must select)
      await config.update('buildFormat', 'icons.ts', vscode.ConfigurationTarget.Global);
      await delay(200);
      let buildFormat = vscode.workspace.getConfiguration('iconManager').get<string>('buildFormat', '');
      assert.strictEqual(buildFormat, 'icons.ts', 'Step 3 should have user-selected build format');
      
      // Step 4: Web component name with hyphen
      await config.update('webComponentName', 'my-app-icon', vscode.ConfigurationTarget.Global);
      await delay(200);
      let webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      let step4Complete = webComponentName && webComponentName.includes('-');
      assert.strictEqual(!!step4Complete, true, 'Step 4 should be complete');
      
      // Verify all 4 steps complete for button enabled
      svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      buildFormat = vscode.workspace.getConfiguration('iconManager').get<string>('buildFormat', '');
      webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      
      const isFullyConfigured = 
        (svgFolders.length > 0 && !!svgFolders[0]) && 
        !!outputDir && 
        !!buildFormat && 
        (webComponentName && webComponentName.includes('-'));
      assert.strictEqual(!!isFullyConfigured, true, 'Button should be enabled after full 4-step configuration');
    });
  });
  
  suite('Step Number CSS Classes (Green Check Marks)', () => {
    
    test('Step 1 number should have "completed" class when svgFolders configured', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: '',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step1NumberClass, 'completed', 
        'Step 1 should show GREEN checkmark when source folder is set');
    });
    
    test('Step 1 number should NOT have "completed" class when svgFolders empty', async () => {
      const classes = getStepNumberClasses({
        svgFolders: [],
        outputDirectory: '',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step1NumberClass, '', 
        'Step 1 should NOT show green checkmark when source folder is empty');
    });
    
    test('Step 2 should be DISABLED until Step 1 is complete', async () => {
      const classesStep1Incomplete = getStepNumberClasses({
        svgFolders: [],
        outputDirectory: '',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesStep1Incomplete.step2Disabled, true, 
        'Step 2 should be DISABLED when Step 1 is not complete');
        
      const classesStep1Complete = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: '',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesStep1Complete.step2Disabled, false, 
        'Step 2 should be UNLOCKED when Step 1 is complete');
    });
    
    test('Step 2 number should have "completed" class when outputDirectory configured', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step2NumberClass, 'completed', 
        'Step 2 should show GREEN checkmark when output directory is set');
    });
    
    test('Step 3 should be DISABLED until Step 2 is complete', async () => {
      const classesStep2Incomplete = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: '',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesStep2Incomplete.step3Disabled, true, 
        'Step 3 should be DISABLED when Step 2 is not complete');
        
      const classesStep2Complete = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'output',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesStep2Complete.step3Disabled, false, 
        'Step 3 should be UNLOCKED when Step 2 is complete');
    });
    
    test('Step 3 number should have "completed" class when buildFormat is selected', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: 'sg-icon',
        buildFormat: 'icons.ts', // User selected this
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step3NumberClass, 'completed', 
        'Step 3 should show GREEN checkmark when build format is selected');
    });
    
    test('Step 3 number should NOT have "completed" class when buildFormat is empty', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: 'sg-icon',
        buildFormat: '', // Not selected yet
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step3NumberClass, '', 
        'Step 3 should NOT show green when build format is not selected');
    });
    
    test('Step 4 should be DISABLED until Step 3 is complete (buildFormat selected)', async () => {
      const classesStep3Incomplete = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: '',
        buildFormat: '', // Not selected - Step 3 incomplete
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesStep3Incomplete.step4Disabled, true, 
        'Step 4 should be DISABLED when Step 3 is not complete');
        
      const classesStep3Complete = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: '',
        buildFormat: 'icons.ts', // Selected - Step 3 complete
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classesStep3Complete.step4Disabled, false, 
        'Step 4 should be UNLOCKED when Step 3 is complete');
    });
    
    test('Step 4 number should have "completed" class when webComponentName has hyphen', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: 'my-icon',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step4NumberClass, 'completed', 
        'Step 4 should show GREEN checkmark when web component name has hyphen');
    });
    
    test('Step 4 number should NOT have "completed" class when webComponentName has no hyphen', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: 'myicon',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step4NumberClass, '', 
        'Step 4 should NOT show green checkmark when web component name has no hyphen');
    });
    
    test('Step 4 number should NOT have "completed" class when webComponentName is empty', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: '',  // No default anymore
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step4NumberClass, '', 
        'Step 4 should NOT show green checkmark when empty (no default)');
    });
    
    test('sg-icon explicitly set should show Step 4 as completed', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/icons'],
        outputDirectory: 'public/icons',
        webComponentName: 'sg-icon',  // User explicitly sets this
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step4NumberClass, 'completed', 
        'Step 4 should show GREEN checkmark when sg-icon explicitly set');
    });
    
    test('All 4 steps should show green when fully configured', async () => {
      const classes = getStepNumberClasses({
        svgFolders: ['src/assets/svg'],
        outputDirectory: 'public/icons',
        webComponentName: 'app-icon',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step1NumberClass, 'completed', 'Step 1 should be GREEN');
      assert.strictEqual(classes.step2NumberClass, 'completed', 'Step 2 should be GREEN');
      assert.strictEqual(classes.step3NumberClass, 'completed', 'Step 3 should be GREEN');
      assert.strictEqual(classes.step4NumberClass, 'completed', 'Step 4 should be GREEN');
      assert.strictEqual(classes.isButtonEnabled, true, 'Button should be ENABLED (blue)');
    });
    
    test('Button should be DISABLED until ALL 4 steps are complete', async () => {
      // Only step 1 complete
      let classes = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: '',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      assert.strictEqual(classes.isButtonEnabled, false, 'Button disabled with only Step 1');
      
      // Steps 1 and 2 complete
      classes = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: '',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      assert.strictEqual(classes.isButtonEnabled, false, 'Button disabled with Steps 1 and 2 only');
      
      // Steps 1, 2, 3 complete but step 4 missing hyphen
      classes = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: 'noHyphen',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      assert.strictEqual(classes.isButtonEnabled, false, 'Button disabled when Step 4 invalid');
      
      // All 4 complete
      classes = getStepNumberClasses({
        svgFolders: ['icons'],
        outputDirectory: 'dist',
        webComponentName: 'my-icon',
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      assert.strictEqual(classes.isButtonEnabled, true, 'Button ENABLED when all 4 steps complete');
    });
  });
  
  suite('Real Config to CSS Classes Integration', () => {
    
    setup(async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', undefined, vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', undefined, vscode.ConfigurationTarget.Global);
      await config.update('webComponentName', undefined, vscode.ConfigurationTarget.Global);
      await config.update('buildFormat', undefined, vscode.ConfigurationTarget.Global);
      await delay(300);
    });
    
    test('Step 1 and 2 green after configuring source and output', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', ['my-svgs'], vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', 'output/icons', vscode.ConfigurationTarget.Global);
      await delay(300);
      
      // Read actual config values
      const svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      const buildFormat = vscode.workspace.getConfiguration('iconManager').get<string>('buildFormat', '');
      
      // Calculate classes using same logic as WelcomePanel
      const classes = getStepNumberClasses({
        svgFolders,
        outputDirectory: outputDir,
        webComponentName,
        buildFormat,
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step1NumberClass, 'completed', 
        'Step 1 number should be GREEN after setting svgFolders');
      assert.strictEqual(classes.step2NumberClass, 'completed', 
        'Step 2 number should be GREEN after setting outputDirectory');
      // Button requires ALL 4 steps now - buildFormat and webComponentName are empty
      assert.strictEqual(classes.isButtonEnabled, false, 
        'Button should be DISABLED when buildFormat/webComponentName not selected');
    });
    
    test('All 4 steps configured makes button enabled', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('svgFolders', ['my-svgs'], vscode.ConfigurationTarget.Global);
      await config.update('outputDirectory', 'output/icons', vscode.ConfigurationTarget.Global);
      await config.update('buildFormat', 'icons.ts', vscode.ConfigurationTarget.Global);
      await config.update('webComponentName', 'my-icon', vscode.ConfigurationTarget.Global);
      await delay(300);
      
      const svgFolders = vscode.workspace.getConfiguration('iconManager').get<string[]>('svgFolders', []);
      const outputDir = vscode.workspace.getConfiguration('iconManager').get<string>('outputDirectory', '');
      const buildFormat = vscode.workspace.getConfiguration('iconManager').get<string>('buildFormat', '');
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      
      const classes = getStepNumberClasses({
        svgFolders,
        outputDirectory: outputDir,
        webComponentName,
        buildFormat,
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step1NumberClass, 'completed', 'Step 1 GREEN');
      assert.strictEqual(classes.step2NumberClass, 'completed', 'Step 2 GREEN');
      assert.strictEqual(classes.step3NumberClass, 'completed', 'Step 3 GREEN');
      assert.strictEqual(classes.step4NumberClass, 'completed', 'Step 4 GREEN');
      assert.strictEqual(classes.isButtonEnabled, true, 
        'Button should be ENABLED when all 4 steps complete');
    });
    
    test('Step 4 green with valid web component name', async () => {
      const config = vscode.workspace.getConfiguration('iconManager');
      await config.update('webComponentName', 'my-custom-icon', vscode.ConfigurationTarget.Global);
      await delay(300);
      
      const webComponentName = vscode.workspace.getConfiguration('iconManager').get<string>('webComponentName', '');
      
      const classes = getStepNumberClasses({
        svgFolders: ['svgs'],
        outputDirectory: 'icons',
        webComponentName,
        buildFormat: 'icons.ts',
        hasBuiltIcons: false
      });
      
      assert.strictEqual(classes.step4NumberClass, 'completed', 
        'Step 4 number should be GREEN with valid hyphenated name');
    });
  });
});
