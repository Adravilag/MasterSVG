const vscode = acquireVsCodeApi();
const helpOpenText = '${helpOpenText}';
const helpClosedText = '${helpClosedText}';

// Frontend Root functions (Step 0)
function setFrontendRoot(dir) {
  vscode.postMessage({ command: 'setFrontendRoot', directory: dir });
}

function chooseFrontendFolder() {
  vscode.postMessage({ command: 'chooseFrontendFolder' });
}

// Source Directory functions
function setSourceDirectory(dir) {
  document.getElementById('sourceDir').value = dir;
  vscode.postMessage({ command: 'setSourceDirectory', directory: dir });
  showApplySuccess('sourceDir');
}

function chooseSourceFolder() {
  vscode.postMessage({ command: 'chooseSourceFolder' });
}

function applyCustomSourcePath() {
  const input = document.getElementById('sourceDir');
  const dir = input.value.trim();
  if (dir) {
    vscode.postMessage({ command: 'setSourceDirectory', directory: dir });
    showApplySuccess('sourceDir');
  }
}

function handleSourcePathKeypress(event) {
  if (event.key === 'Enter') {
    applyCustomSourcePath();
  }
}

// Output Directory functions
function setDirectory(dir) {
  document.getElementById('outputDir').value = dir;
  vscode.postMessage({ command: 'setOutputDirectory', directory: dir });
  showApplySuccess('outputDir');
}

function chooseFolder() {
  vscode.postMessage({ command: 'chooseFolder' });
}

function applyCustomPath() {
  const input = document.getElementById('outputDir');
  const dir = input.value.trim();
  if (dir) {
    vscode.postMessage({ command: 'setOutputDirectory', directory: dir });
    showApplySuccess('outputDir');
  }
}

function handlePathKeypress(event) {
  if (event.key === 'Enter') {
    applyCustomPath();
  }
}

function setBuildFormat(format) {
  vscode.postMessage({ command: 'setBuildFormat', format: format });
  // Visual feedback for format cards is handled by CSS :active and page refresh
}

function setFramework(framework) {
  // Update visual selection
  document.querySelectorAll('.framework-option').forEach(opt => opt.classList.remove('selected'));
  event.currentTarget.classList.add('selected');
  // Send message to extension
  vscode.postMessage({ command: 'setFramework', framework: framework });
}

function setLanguage(lang) {
  vscode.postMessage({ command: 'setLanguage', language: lang });
}

function applyWebComponentName() {
  const input = document.getElementById('webComponentName');
  const name = input.value.trim();
  // Accept any non-empty name - server-side validation handles framework-specific rules
  if (name) {
    vscode.postMessage({ command: 'setWebComponentName', name: name });
    showApplySuccess('webComponentName');
  }
}

function handleTagKeypress(event) {
  if (event.key === 'Enter') {
    applyWebComponentName();
  }
}

// Visual feedback functions
function showApplySuccess(inputId) {
  const input = document.getElementById(inputId);
  const button = input.parentElement.querySelector('button');
  
  // Add success class to input
  input.classList.add('input-success');
  if (button) {
    button.classList.add('btn-success');
  }
  
  // Remove after animation
  setTimeout(() => {
    input.classList.remove('input-success');
    if (button) {
      button.classList.remove('btn-success');
    }
  }, 1500);
}

function showApplyError(inputId) {
  const input = document.getElementById(inputId);
  const button = input.parentElement.querySelector('button');
  
  // Add error class to input
  input.classList.add('input-error');
  if (button) {
    button.classList.add('btn-error');
  }
  
  // Remove after animation
  setTimeout(() => {
    input.classList.remove('input-error');
    if (button) {
      button.classList.remove('btn-error');
    }
  }, 1500);
}

function toggleHelp() {
  const helpPanel = document.getElementById('helpPanel');
  const helpLink = document.querySelector('.help-link');
  helpPanel.classList.toggle('show');
  helpLink.textContent = helpPanel.classList.contains('show') ? helpOpenText : helpClosedText;
}

function openSettings() {
  vscode.postMessage({ command: 'openSettings' });
}

function finishSetup() {
  vscode.postMessage({ command: 'finishSetup' });
}

function searchIcons() {
  vscode.postMessage({ command: 'searchIcons' });
}

function close() {
  vscode.postMessage({ command: 'close' });
}

// Advanced Options
function toggleAdvanced() {
  const content = document.getElementById('advancedContent');
  const arrow = document.getElementById('advancedArrow');
  content.classList.toggle('show');
  arrow.classList.toggle('open');
}

function setScanOnStartup(checked) {
  vscode.postMessage({ command: 'setScanOnStartup', value: checked });
}

function setDefaultIconSize(value) {
  const size = parseInt(value, 10);
  if (size >= 8 && size <= 512) {
    vscode.postMessage({ command: 'setDefaultIconSize', value: size });
  }
}

function setPreviewBackground(value) {
  vscode.postMessage({ command: 'setPreviewBackground', value: value });
}

function setCreateMsignore(checked) {
  vscode.postMessage({ command: 'setCreateMsignore', value: checked });
}

function setSeparateOutputStructure(checked) {
  vscode.postMessage({ command: 'setSeparateOutputStructure', value: checked });
}
