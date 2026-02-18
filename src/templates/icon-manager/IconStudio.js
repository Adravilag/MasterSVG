const vscode = acquireVsCodeApi();
const i18n = __I18N__;

let currentTab = 'workspace';
let workspaceIcons = [];
let libraryIcons = [];
let searchQuery = '';
let currentConfig = {};

// Utility: debounce
function debounce(fn, wait = 250) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

const content = document.getElementById('content');
const searchInput = document.getElementById('searchInput');
const tabs = document.querySelectorAll('.tab');

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderContent();
  });
});

// Search
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value.toLowerCase();
  renderContent();
});

// Message handling
window.addEventListener('message', event => {
  const message = event.data;

  switch (message.type) {
    case 'workspaceIcons':
      workspaceIcons = message.icons || [];
      if (currentTab === 'workspace') renderContent();
      break;

    case 'libraryIcons':
      libraryIcons = message.icons || [];
      if (currentTab === 'library') renderContent();
      break;

    case 'search':
      searchInput.value = message.query;
      searchQuery = message.query.toLowerCase();
      renderContent();
      break;

    case 'config':
      try {
        const cfg = message.data || {};
        currentConfig = cfg;
        // mark active build format
        const formatBtns = document.querySelectorAll('.format-btn');
        formatBtns.forEach(b => b.classList.remove('active'));
        if (cfg.buildFormat) {
          const btn = Array.from(formatBtns).find(x => x.getAttribute('data-format') === cfg.buildFormat);
          if (btn) btn.classList.add('active');
        }
        // set splitTs checkbox
        if (typeof cfg.splitTs === 'boolean') {
          const cb = document.getElementById('splitTsCheckbox');
          if (cb) cb.checked = cfg.splitTs;
        }
        // re-render options and refresh preview
        setTimeout(() => { renderBuildOptions(cfg.buildFormat); refreshPreview(); }, 0);
        // update watch toggle if present
        try {
          const watchEl = document.getElementById('watchModeToggle');
          if (watchEl && typeof cfg.watchMode === 'boolean') watchEl.checked = cfg.watchMode;
          const status = document.getElementById('watchStatus');
          if (status) status.textContent = '';
        } catch (e) { /* ignore */ }
      } catch (e) { console.error('Failed handling config message', e); }
      break;
  }
});

// Code preview handlers
function openCodePreview() {
  const modal = document.getElementById('codePreviewModal');
  const body = document.getElementById('codePreviewBody');
  const lang = document.getElementById('codePreviewLang');
  if (!modal || !body) return;
  const activeFormatBtn = Array.from(document.querySelectorAll('.format-btn')).find(b => b.classList.contains('active'));
  const format = activeFormatBtn ? activeFormatBtn.getAttribute('data-format') : 'icons.js';
  const sample = generateSampleCode(format, currentConfig || {});
  lang.textContent = sample.language || 'TSX';
  body.textContent = sample.code || '';
  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'block';
  refreshPreview();
}

function closeCodePreview() {
  const modal = document.getElementById('codePreviewModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  modal.style.display = 'none';
}

function refreshPreview() {
  const modal = document.getElementById('codePreviewModal');
  const body = document.getElementById('codePreviewBody');
  const lang = document.getElementById('codePreviewLang');
  if (!modal || modal.getAttribute('aria-hidden') === 'true') return;
  const activeFormatBtn = Array.from(document.querySelectorAll('.format-btn')).find(b => b.classList.contains('active'));
  const format = activeFormatBtn ? activeFormatBtn.getAttribute('data-format') : 'icons.js';
  const sample = generateSampleCode(format, currentConfig || {});
  if (lang) lang.textContent = sample.language || 'TSX';
  if (body) body.textContent = sample.code || '';
}

// Watch toggle handling and processing indicator
function setWatchToggleHandlers() {
  const el = document.getElementById('watchModeToggle');
  const status = document.getElementById('watchStatus');
  if (!el) return;
  el.addEventListener('change', (ev) => {
    const checked = ev.target.checked;
    currentConfig.watchMode = checked;
    vscode.postMessage({ type: 'toggleWatchMode', value: checked });
    if (status) status.textContent = checked ? 'Watch Mode: ON' : 'Watch Mode: OFF';
  });
}

// Listen host messages for processing state
window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'watchProcessing') {
    const status = document.getElementById('watchStatus');
    if (!status) return;
    if (message.state === 'start') status.textContent = 'Sincronizando...';
    else if (message.state === 'end') status.textContent = 'Sincronización completada';
  }
});

function generateSampleCode(format, cfg) {
  const exportType = cfg.exportType || 'named';
  const naming = cfg.naming || 'IconHome';
  const typescript = typeof cfg.typescript === 'boolean' ? cfg.typescript : true;
  const forwardRef = typeof cfg.forwardRef === 'boolean' ? cfg.forwardRef : true;

  if (format === 'sprite.svg') {
    return { language: 'SVG', code: `<svg class="icon-sprite"><use xlink:href="#${cfg.spritePrefix || 'icon'}-home"></use></svg>\n\n<!-- sprite file: ${cfg.spriteFilename || 'sprite.svg'} -->` };
  }

  if (format === 'css') {
    const method = cfg.cssMethod === 'background' ? 'background-image' : 'mask-image';
    const prefix = cfg.classPrefix || 'i-';
    return { language: 'CSS', code: `.${prefix}home {\n  ${method}: url('/icons/home.svg');\n  width: 24px;\n  height: 24px;\n  display: inline-block;\n  background-color: currentColor;\n}` };
  }

  // React module sample
  const ext = typescript ? 'tsx' : 'jsx';
  const componentName = naming === 'Home' ? 'Home' : naming;
  const importLine = `import React from 'react';`;
  const propsType = typescript ? 'IconProps' : null;
  const interfaceLine = typescript ? `\ninterface ${propsType} extends React.SVGProps<SVGSVGElement> {}` : '';

  let componentDef = '';
  if (forwardRef) {
    if (typescript) {
      componentDef += `\nconst ${componentName} = React.forwardRef<SVGSVGElement, ${propsType}>(function ${componentName}(props, ref) {\n  return (\n    <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" ref={ref} {...props}>\n      <path d=\"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z\" />\n    </svg>\n  );\n});\n`;
    } else {
      componentDef += `\nconst ${componentName} = React.forwardRef(function ${componentName}(props, ref) {\n  return (\n    <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" ref={ref} {...props}>\n      <path d=\"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z\" />\n    </svg>\n  );\n});\n`;
    }
  } else {
    if (typescript) {
      componentDef += `\nconst ${componentName}: React.FC<${propsType}> = (props) => {\n  return (\n    <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" {...props}>\n      <path d=\"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z\" />\n    </svg>\n  );\n};\n`;
    } else {
      componentDef += `\nfunction ${componentName}(props) {\n  return (\n    <svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" {...props}>\n      <path d=\"M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z\" />\n    </svg>\n  );\n}\n`;
    }
  }

  const exportLines = exportType === 'default' ? `\nexport default ${componentName};` : `\nexport { ${componentName} };`;
  const code = `${importLine}${interfaceLine}\n${componentDef}${exportLines}`.trim();
  return { language: ext.toUpperCase(), code };
}

function renderContent() {
  switch (currentTab) {
    case 'workspace': renderIcons(workspaceIcons); break;
    case 'library': renderIcons(libraryIcons); break;
    case 'online': renderOnline(); break;
  }
}

function renderIcons(icons) {
  const filtered = icons.filter(icon => icon.name.toLowerCase().includes(searchQuery));
  if (filtered.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>${icons.length === 0 ? i18n.noIconsFound : i18n.noIconsMatch}</p>
        ${icons.length === 0 ? '<button class="btn" onclick="scanWorkspace()">' + i18n.scanWorkspaceBtn + '</button>' : ''}
      </div>
    `;
    return;
  }

  content.innerHTML = '<div class="icons-grid"></div>';
  const grid = content.querySelector('.icons-grid');
  filtered.forEach(icon => {
    const item = document.createElement('div');
    item.className = 'icon-item';
    item.innerHTML = `${icon.svg || '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="4"/></svg>'}<span class="name" title="${icon.name}">${icon.name}</span>`;
    item.addEventListener('click', () => insertIcon(icon.name));
    grid.appendChild(item);
  });
}

function renderOnline() {
  content.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
      <p>${i18n.browseIconify}</p>
      <p style="font-size: 11px; margin-top: 8px;">${i18n.comingSoon}</p>
    </div>
  `;
}

function insertIcon(name) {
  const splitTs = document.getElementById('splitTsCheckbox') && document.getElementById('splitTsCheckbox').checked;
  vscode.postMessage({ type: 'insertIcon', iconName: name, splitTs });
}

function setBuildFormat(format) {
  // Optimistically update UI
  const formatBtns = document.querySelectorAll('.format-btn');
  formatBtns.forEach(b => b.classList.remove('active'));
  const clicked = Array.from(formatBtns).find(x => x.getAttribute('data-format') === format);
  if (clicked) clicked.classList.add('active');
  vscode.postMessage({ type: 'setBuildFormat', format });
  renderBuildOptions(format);
}

function scanWorkspace() { vscode.postMessage({ type: 'scanWorkspace' }); }

// Dynamic build options
function renderBuildOptions(currentFormat) {
  const container = document.getElementById('buildAdvancedOptions');
  if (!container) return;
  container.innerHTML = '';
  const cfg = currentConfig || {};

  function createRow(labelText, inputEl) {
    const row = document.createElement('div');
    row.className = 'option-row';
    const label = document.createElement('label');
    label.className = 'option-label';
    label.textContent = labelText;
    row.appendChild(label);
    if (Array.isArray(inputEl)) {
      const [el, helpText] = inputEl;
      row.appendChild(el);
      if (helpText) {
        const info = document.createElement('button');
        info.className = 'option-help';
        info.type = 'button';
        info.title = helpText;
        info.textContent = 'i';
        row.appendChild(info);
      }
    } else {
      row.appendChild(inputEl);
    }
    return row;
  }

  if (!currentFormat) {
    const active = Array.from(document.querySelectorAll('.format-btn')).find(b => b.classList.contains('active'));
    currentFormat = active ? active.getAttribute('data-format') : 'icons.js';
  }

  // Module JS options
  if (currentFormat === 'icons.js' || currentFormat === 'icons.jsx' || currentFormat === 'icons.tsx' || currentFormat === 'icons.mjs') {
    const exportSelect = document.createElement('select');
    exportSelect.id = 'exportTypeSelect';
    ['named','default'].forEach(v => { const o = document.createElement('option'); o.value = v; o.text = v === 'named' ? 'Named export' : 'Default export'; exportSelect.appendChild(o); });
    exportSelect.value = cfg.exportType || 'named';
    exportSelect.addEventListener('change', () => { vscode.postMessage({ type: 'updateConfig', key: 'exportType', value: exportSelect.value }); currentConfig.exportType = exportSelect.value; refreshPreview(); });
    container.appendChild(createRow('Export Type', exportSelect));

    const namingSelect = document.createElement('select');
    namingSelect.id = 'namingSelect';
    [{v:'IconHome', t:'IconHome'},{v:'HomeIcon', t:'HomeIcon'},{v:'Home', t:'Home'}].forEach(it => { const o = document.createElement('option'); o.value = it.v; o.text = it.t; namingSelect.appendChild(o); });
    namingSelect.value = cfg.naming || 'IconHome';
    namingSelect.addEventListener('change', () => { vscode.postMessage({ type: 'updateConfig', key: 'naming', value: namingSelect.value }); currentConfig.naming = namingSelect.value; refreshPreview(); });
    container.appendChild(createRow('Naming', namingSelect));

    const fr = document.createElement('input'); fr.type = 'checkbox'; fr.id = 'forwardRefCheckbox'; fr.checked = typeof cfg.forwardRef === 'boolean' ? cfg.forwardRef : true;
    fr.addEventListener('change', () => { vscode.postMessage({ type: 'updateConfig', key: 'forwardRef', value: fr.checked }); currentConfig.forwardRef = fr.checked; refreshPreview(); });
    container.appendChild(createRow('React forwardRef', [fr, 'Permite pasar ref al elemento SVG (necesario para algunas librerías)']));
  }

  // Sprite SVG options
  if (currentFormat === 'sprite.svg') {
    const filenameInput = document.createElement('input'); filenameInput.type = 'text'; filenameInput.id = 'spriteFilename'; filenameInput.value = cfg.spriteFilename || 'sprite.svg';
    filenameInput.addEventListener('input', debounce(() => { vscode.postMessage({ type: 'updateConfig', key: 'spriteFilename', value: filenameInput.value }); currentConfig.spriteFilename = filenameInput.value; refreshPreview(); }, 300));
    container.appendChild(createRow('Sprite Filename', filenameInput));

    const prefixInput = document.createElement('input'); prefixInput.type = 'text'; prefixInput.id = 'spritePrefix'; prefixInput.value = cfg.spritePrefix || 'icon';
    prefixInput.addEventListener('input', debounce(() => { vscode.postMessage({ type: 'updateConfig', key: 'spritePrefix', value: prefixInput.value }); currentConfig.spritePrefix = prefixInput.value; refreshPreview(); }, 250));
    container.appendChild(createRow('ID Prefix', prefixInput));
  }

  // CSS Icons options
  if (currentFormat === 'css') {
    const classInput = document.createElement('input'); classInput.type = 'text'; classInput.id = 'classPrefix'; classInput.value = cfg.classPrefix || 'i-';
    classInput.addEventListener('input', debounce(() => { vscode.postMessage({ type: 'updateConfig', key: 'classPrefix', value: classInput.value }); currentConfig.classPrefix = classInput.value; refreshPreview(); }, 250));
    container.appendChild(createRow('Class Prefix', classInput));

    const methodSelect = document.createElement('select'); methodSelect.id = 'cssMethod'; ['mask','background'].forEach(v => { const o = document.createElement('option'); o.value = v; o.text = v === 'mask' ? 'mask-image' : 'background-image'; methodSelect.appendChild(o); });
    methodSelect.value = cfg.cssMethod || 'mask';
    methodSelect.addEventListener('change', () => { vscode.postMessage({ type: 'updateConfig', key: 'cssMethod', value: methodSelect.value }); currentConfig.cssMethod = methodSelect.value; refreshPreview(); });
    container.appendChild(createRow('Method', methodSelect));
  }
}

// initial load
vscode.postMessage({ type: 'getWorkspaceIcons' });
vscode.postMessage({ type: 'getLibraryIcons' });
vscode.postMessage({ type: 'getConfig' });
setTimeout(() => renderBuildOptions(), 150);
