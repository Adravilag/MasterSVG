const vscode = acquireVsCodeApi();

let currentTab = 'workspace';
let workspaceIcons = [];
let libraryIcons = [];
let searchQuery = '';

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
  }
});

function renderContent() {
  switch (currentTab) {
    case 'workspace':
      renderIcons(workspaceIcons);
      break;
    case 'library':
      renderIcons(libraryIcons);
      break;
    case 'online':
      renderOnline();
      break;
  }
}

function renderIcons(icons) {
  const filtered = icons.filter(icon => 
    icon.name.toLowerCase().includes(searchQuery)
  );

  if (filtered.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p>${icons.length === 0 ? 'No icons found. Scan your workspace to detect SVG files.' : 'No icons match your search.'}</p>
        ${icons.length === 0 ? '<button class="btn" onclick="scanWorkspace()">Scan Workspace</button>' : ''}
      </div>
    `;
    return;
  }

  content.innerHTML = '<div class="icons-grid"></div>';
  const grid = content.querySelector('.icons-grid');

  filtered.forEach(icon => {
    const item = document.createElement('div');
    item.className = 'icon-item';
    item.innerHTML = `
      ${icon.svg || '<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="4"/></svg>'}
      <span class="name" title="${icon.name}">${icon.name}</span>
    `;
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
      <p>Browse icons from Iconify</p>
      <p style="font-size: 11px; margin-top: 8px;">Coming soon...</p>
    </div>
  `;
}

function insertIcon(name) {
  vscode.postMessage({ type: 'insertIcon', iconName: name });
}

function scanWorkspace() {
  vscode.postMessage({ type: 'scanWorkspace' });
}

// Initial load
vscode.postMessage({ type: 'getWorkspaceIcons' });
vscode.postMessage({ type: 'getLibraryIcons' });
