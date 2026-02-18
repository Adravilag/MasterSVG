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
  // Immediate UI update: enable/disable cssElementTag input when selecting CSS
  try {
    const cssInput = document.getElementById('cssElementTag');
    if (cssInput) {
      if (format === 'css') {
        cssInput.removeAttribute('disabled');
        cssInput.removeAttribute('title');
      } else {
        cssInput.setAttribute('disabled', 'disabled');
        cssInput.setAttribute('title', 'Applies only to CSS output');
      }
    }
    // Update visual selection for format cards
    document.querySelectorAll('.format-card').forEach(card => card.classList.remove('selected'));
    const selector = format === 'icons.js' ? '.format-card[onclick="setBuildFormat(\'icons.js\')"]' : format === 'sprite.svg' ? '.format-card[onclick="setBuildFormat(\'sprite.svg\')"]' : format === 'css' ? '.format-card[onclick="setBuildFormat(\'css\')"]' : null;
    if (selector) {
      const el = document.querySelector(selector);
      if (el) el.classList.add('selected');
    }
  } catch (e) {
    // ignore
  }
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

// Build Options
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

function setCodeIntegration(checked) {
  vscode.postMessage({ command: 'setCodeIntegration', value: checked });
}

function setCssElementTag(value) {
  vscode.postMessage({ command: 'setCssElementTag', value: value });
}

function setDefaultSvgColor(value) {
  vscode.postMessage({ command: 'setDefaultSvgColor', value: value });
  try {
    const el = document.getElementById('defaultSvgColorDisplay');
    if (el) {
      if (!value || value === 'currentColor') {
        el.innerHTML = '<span class="tag-neutral small">currentColor</span>';
      } else {
        el.innerHTML = '<span class="color-hex-badge">' + value + '</span>';
      }
    }
  } catch (e) {
    // ignore DOM update errors in webview
  }
}
