    const vscode = acquireVsCodeApi();
    const i18n = __I18N__;

    // State
    let currentZoom = 3;
    const zoomLevels = [50, 75, 100, 150, 200];

    // Zoom functions
    function updateZoom() {
      const previewBox = document.getElementById('previewBox');
      const zoomLevel = document.getElementById('zoomLevel');

      previewBox.className = 'preview-box zoom-' + currentZoom;
      zoomLevel.textContent = zoomLevels[currentZoom - 1] + '%';
    }

    function zoomIn() {
      if (currentZoom < 5) {
        currentZoom++;
        updateZoom();
      }
    }

    function zoomOut() {
      if (currentZoom > 1) {
        currentZoom--;
        updateZoom();
      }
    }

    function resetZoom() {
      currentZoom = 3;
      updateZoom();
    }

    // Copy functions
    function copyName() {
      vscode.postMessage({ command: 'copyName' });
    }

    function copySvg() {
      const svg = document.querySelector('.preview-box svg');
      vscode.postMessage({ command: 'copySvg', svg: svg?.outerHTML });
    }

    function copyColor(color) {
      navigator.clipboard.writeText(color).then(() => {
        vscode.postMessage({ command: 'showMessage', message: `Copied: ${color}` });
      });
    }

    function openExternal(url) {
      event.preventDefault();
      event.stopPropagation();
      vscode.postMessage({ command: 'openExternal', url: url });
    }

    function openEditor() {
      vscode.postMessage({ command: 'openEditor' });
    }

    // Color picker
    function changeColor(oldColor, newColor) {
      vscode.postMessage({ command: 'changeColor', oldColor, newColor });
    }

    function addColor() {
      // Create a color input and trigger it
      const input = document.createElement('input');
      input.type = 'color';
      input.value = '#000000';
      input.style.display = 'none';
      document.body.appendChild(input);

      input.addEventListener('change', () => {
        vscode.postMessage({ command: 'addColorToSvg', color: input.value });
        document.body.removeChild(input);
      });

      input.click();
    }

    // Variants functionality
    function applyDefaultVariant() {
      vscode.postMessage({ command: 'applyDefaultVariant' });
    }

    function applyVariant(index) {
      vscode.postMessage({ command: 'applyVariant', index: index });
    }

    function saveVariant() {
      vscode.postMessage({ command: 'saveVariant' });
    }

    function deleteVariant(index) {
      vscode.postMessage({ command: 'deleteVariant', index: index });
    }

    function setDefaultVariant(variantName) {
      // Default-variant setting removed; no-op
      console.debug('[IconDetails] setDefaultVariant called but feature removed');
    }

    // Navigation
    function goToLocation() {
      vscode.postMessage({ command: 'goToLocation' });
    }

    function goToUsage(file, line) {
      vscode.postMessage({ command: 'goToUsage', file, line });
    }

    // Auto-search usages on load
    vscode.postMessage({ command: 'findUsages' });

    // Message handler
    window.addEventListener('message', event => {
      const message = event.data;

      if (message.command === 'usagesResult') {
          const countEl = document.getElementById('usagesCount');
          const listEl = document.getElementById('usagesList');

          countEl.textContent = message.total + ' ' + i18n.found;

          function escapeHtml(s) {
            return String(s)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;');
          }

          if (message.usages.length === 0) {
            listEl.innerHTML = '<div class="empty-state"><span class="codicon codicon-info"></span> ' + i18n.noUsagesFound + '</div>';
          } else {
            listEl.innerHTML = message.usages.map((u, idx) => {
              const shortFile = u.file.split(/[\\\/]/).slice(-3).join('/');
              const escaped = escapeHtml(u.preview);
              return `
                <div class="usage-item" data-usage-index="${idx}" style="cursor: pointer;">
                  <div class="usage-file">${shortFile}:${u.line}</div>
                  <pre class="usage-preview"><code>${escaped}</code></pre>
                </div>
              `;
            }).join('');

            // Attach event listeners
            document.querySelectorAll('.usage-item').forEach((el, idx) => {
              el.addEventListener('click', () => {
                const u = message.usages[idx];
                goToUsage(u.file, u.line);
              });
            });
          }
        }

      if (message.command === 'colorChanged') {
        // Update preview with new SVG
        const previewBox = document.getElementById('previewBox');
        previewBox.innerHTML = message.svg;
      }

      if (message.command === 'variantApplied') {
        // Update preview with new SVG from applied variant
        const previewBox = document.getElementById('previewBox');
        previewBox.innerHTML = message.svg;

        // Update variant selection UI
        document.querySelectorAll('.variant-item').forEach((item, index) => {
          item.classList.remove('selected');
          if (message.variantIndex === -1 && item.classList.contains('default')) {
            item.classList.add('selected');
          } else if (message.variantIndex === index) {
            item.classList.add('selected');
          }
        });
      }
    });

