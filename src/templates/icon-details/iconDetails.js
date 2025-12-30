    const vscode = acquireVsCodeApi();
    const i18n = __I18N__;
    
    // State
    let currentZoom = 3;
    let optimizedSvg = null;
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
    
    // Optimization functions
    function optimizeSvg(preset) {
      // Update button states
      document.querySelectorAll('.optimize-preset').forEach(btn => btn.classList.remove('active'));
      event.target.classList.add('active');
      
      vscode.postMessage({ command: 'optimizeSvg', preset });
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
      vscode.postMessage({ command: 'setDefaultVariant', variantName: variantName });
    }
    
    function applyOptimizedSvg() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'applyOptimizedSvg', svg: optimizedSvg });
        
        // Update preview
        const previewBox = document.getElementById('previewBox');
        previewBox.innerHTML = optimizedSvg;
        
        // Update file size display
        const size = new Blob([optimizedSvg]).size;
        const sizeStr = size < 1024 ? size + ' B' : (size / 1024).toFixed(1) + ' KB';
        document.getElementById('fileSize').textContent = sizeStr;
      }
    }
    
    function copyOptimizedSvg() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'copySvg', svg: optimizedSvg });
      }
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
        
        countEl.textContent = message.total + ' found';
        
        if (message.usages.length === 0) {
          listEl.innerHTML = '<div class="empty-state"><span class="codicon codicon-info"></span> ' + i18n.noUsagesFound + '</div>';
        } else {
          listEl.innerHTML = message.usages.map(u => {
            const shortFile = u.file.split(/[\\/]/).slice(-3).join('/');
            return `
              <div class="usage-item" onclick="goToUsage('${u.file.replace(/\\/g, '\\\\')}', ${u.line})">
                <div class="usage-file">${shortFile}:${u.line}</div>
                <div class="usage-preview">${u.preview.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
              </div>
            `;
          }).join('');
        }
      }
      
      if (message.command === 'optimizeResult') {
        optimizedSvg = message.svg;
        
        const resultEl = document.getElementById('optimizeResult');
        resultEl.classList.add('visible');
        
        document.getElementById('optimizeOriginal').textContent = i18n.original + ' ' + message.originalSizeStr;
        document.getElementById('optimizeNew').textContent = i18n.optimized + ' ' + message.optimizedSizeStr;
        document.getElementById('optimizeSavings').textContent = 
          i18n.saved + ' ' + (message.savingsPercent > 0 ? message.savingsPercent.toFixed(1) + '%' : i18n.alreadyOptimal);
      }
      
      if (message.command === 'colorChanged') {
        // Update preview with new SVG
        const previewBox = document.getElementById('previewBox');
        previewBox.innerHTML = message.svg;
      }
    });
