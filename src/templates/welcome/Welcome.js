const vscode = acquireVsCodeApi();
const helpOpenText = '${helpOpenText}';
const helpClosedText = '${helpClosedText}';

// Source Directory functions
function setSourceDirectory(dir) {
  document.getElementById('sourceDir').value = dir;
  vscode.postMessage({ command: 'setSourceDirectory', directory: dir });
}

function chooseSourceFolder() {
  vscode.postMessage({ command: 'chooseSourceFolder' });
}

function applyCustomSourcePath() {
  const dir = document.getElementById('sourceDir').value.trim();
  if (dir) {
    vscode.postMessage({ command: 'setSourceDirectory', directory: dir });
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
}

function chooseFolder() {
  vscode.postMessage({ command: 'chooseFolder' });
}

function applyCustomPath() {
  const dir = document.getElementById('outputDir').value.trim();
  if (dir) {
    vscode.postMessage({ command: 'setOutputDirectory', directory: dir });
  }
}

function handlePathKeypress(event) {
  if (event.key === 'Enter') {
    applyCustomPath();
  }
}

function setBuildFormat(format) {
  vscode.postMessage({ command: 'setBuildFormat', format: format });
}

function setLanguage(lang) {
  vscode.postMessage({ command: 'setLanguage', language: lang });
}

function applyWebComponentName() {
  const name = document.getElementById('webComponentName').value.trim();
  if (name && name.includes('-')) {
    vscode.postMessage({ command: 'setWebComponentName', name: name });
  }
}

function handleTagKeypress(event) {
  if (event.key === 'Enter') {
    applyWebComponentName();
  }
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
