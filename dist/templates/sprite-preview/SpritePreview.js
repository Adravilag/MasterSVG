// SpritePreview.js - JavaScript for sprite/icons file preview
const vscode = acquireVsCodeApi();
let selectedIconId = null;
const contextMenu = document.getElementById('contextMenu');
const grid = document.getElementById('grid');

// Handle icon click (select)
grid.addEventListener('click', (e) => {
  const card = e.target.closest('.icon-card');
  if (card) {
    document.querySelectorAll('.icon-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedIconId = card.dataset.iconId;
  }
  hideContextMenu();
});

// Handle right-click (context menu)
grid.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const card = e.target.closest('.icon-card');
  if (card) {
    selectedIconId = card.dataset.iconId;
    document.querySelectorAll('.icon-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    showContextMenu(e.clientX, e.clientY);
  }
});

// Handle context menu actions
contextMenu.addEventListener('click', (e) => {
  const item = e.target.closest('.context-menu-item');
  if (item && selectedIconId) {
    const action = item.dataset.action;
    vscode.postMessage({ command: action, iconId: selectedIconId });
    hideContextMenu();
  }
});

// Hide context menu on click outside
document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target)) {
    hideContextMenu();
  }
});

function showContextMenu(x, y) {
  contextMenu.style.left = x + 'px';
  contextMenu.style.top = y + 'px';
  contextMenu.classList.add('visible');
}

function hideContextMenu() {
  contextMenu.classList.remove('visible');
}

function openFile() {
  vscode.postMessage({ command: 'openFile' });
}

function refresh() {
  vscode.postMessage({ command: 'refresh' });
}

// Handle messages from extension
window.addEventListener('message', (event) => {
  const message = event.data;
  if (message.command === 'refreshComplete') {
    const newCards = message.icons.map(icon => `
      <div class="icon-card" data-icon-id="${icon.id}" title="${icon.id}">
        <div class="icon-preview">${icon.svg}</div>
        <div class="icon-name">${icon.id}</div>
      </div>
    `).join('');
    grid.innerHTML = newCards;
    document.getElementById('stats').textContent = message.count + ' icons';
  }
});
