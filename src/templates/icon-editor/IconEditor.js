(function() {
    const vscode = acquireVsCodeApi();
    
    // i18n translations injected from TypeScript
    const i18n = __I18N__;
    
    let currentZoom = 3;
    let optimizedSvg = null;
    let currentAnimation = __ANIMATION_TYPE__;
    let animationSettings = { 
      duration: __ANIMATION_DURATION__, 
      timing: __ANIMATION_TIMING__, 
      iteration: __ANIMATION_ITERATION__,
      delay: __ANIMATION_DELAY__,
      direction: __ANIMATION_DIRECTION__
    };
    const originalColors = __ORIGINAL_COLORS__;
    const currentColors = __CURRENT_COLORS__;
    const zoomLevels = [50, 75, 100, 150, 200];
    
    // Track if filters were calculated (informative) or manually changed
    let filtersAreCalculated = false;
    
    window.revertOptimized = function() {
      vscode.postMessage({
        command: 'revertOptimization'
      });
    };

    // Copy to clipboard utility
    window.copyToClipboard = function(text) {
      navigator.clipboard.writeText(text).then(() => {
        vscode.postMessage({ command: 'showMessage', message: `Copied: ${text}` });
      }).catch(() => {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        vscode.postMessage({ command: 'showMessage', message: `Copied: ${text}` });
      });
    };

    // Filter functions
    window.updateFilters = function(isUserAction = true) {
      // If user manually changes filters, mark them as not calculated
      if (isUserAction) {
        filtersAreCalculated = false;
      }
      
      const hue = parseInt(document.getElementById('hueSlider').value);
      const saturation = parseInt(document.getElementById('saturationSlider').value);
      const brightness = parseInt(document.getElementById('brightnessSlider').value);
      
      document.getElementById('hueValue').textContent = hue + 'deg';
      document.getElementById('saturationValue').textContent = saturation + '%';
      document.getElementById('brightnessValue').textContent = brightness + '%';
      
      const filterString = `hue-rotate(${hue}deg) saturate(${saturation}%) brightness(${brightness}%)`;
      const hasFilters = hue !== 0 || saturation !== 100 || brightness !== 100;

      const container = document.getElementById('zoomContainer');
      if (container) {
        const svg = container.querySelector('svg');
        if (svg) {
          svg.style.filter = filterString;
        }
      }

      // Update color swatches and labels to reflect filters
      const colorItems = document.querySelectorAll('.color-item');
      const filteredColors = []; // Collect filtered colors for variant update
      colorItems.forEach((item, idx) => {
        const label = item.querySelector('.color-label');
        const input = item.querySelector('input[type="color"]');
        const swatch = item.querySelector('.color-swatch');
        if (label && input && swatch) {
          const originalColor = input.dataset.originalColor || input.value;
          if (hasFilters) {
            const filteredColor = applyColorFilters(originalColor, hue, saturation, brightness);
            filteredColors.push(filteredColor);
            // Update label
            label.textContent = filteredColor;
            label.style.color = 'var(--vscode-charts-yellow)';
            label.title = i18n.originalColor.replace('{color}', originalColor);
            // Update swatch background directly (no CSS filter)
            swatch.style.backgroundColor = filteredColor;
            swatch.style.filter = 'none';
            // Update picker value
            input.value = filteredColor;
          } else {
            filteredColors.push(originalColor);
            label.textContent = originalColor;
            label.style.color = '';
            label.title = '';
            // Restore original color
            swatch.style.backgroundColor = originalColor;
            swatch.style.filter = '';
            if (originalColor.startsWith('#')) {
              input.value = originalColor;
            }
          }
        }
      });

      // Update the selected variant's color dots (custom variant)
      const selectedVariant = document.querySelector('.variant-item.selected:not(.default)');
      if (selectedVariant && filteredColors.length > 0) {
        const dotsContainer = selectedVariant.querySelector('.variant-colors');
        if (dotsContainer) {
          const dotsHtml = filteredColors.slice(0, 4).map(c => 
            `<div class="variant-color-dot" style="background:${c}" title="${c}"></div>`
          ).join('');
          dotsContainer.innerHTML = dotsHtml;
        }
      }
    };

    // Apply HSB filters to a color and return the result
    function applyColorFilters(colorStr, hue, saturation, brightness) {
      // Convert color to RGB values
      let r, g, b;
      
      if (colorStr.startsWith('#')) {
        const hex = colorStr.slice(1);
        if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16);
          g = parseInt(hex[1] + hex[1], 16);
          b = parseInt(hex[2] + hex[2], 16);
        } else if (hex.length === 6) {
          r = parseInt(hex.slice(0, 2), 16);
          g = parseInt(hex.slice(2, 4), 16);
          b = parseInt(hex.slice(4, 6), 16);
        } else {
          return colorStr;
        }
      } else if (colorStr.startsWith('rgb')) {
        // Handle rgb() and rgba()
        const match = colorStr.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
        if (match) {
          r = parseInt(match[1]);
          g = parseInt(match[2]);
          b = parseInt(match[3]);
        } else {
          return colorStr;
        }
      } else {
        return colorStr; // Can't process named colors easily
      }

      // Convert to HSL
      r /= 255; g /= 255; b /= 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
          case g: h = ((b - r) / d + 2) / 6; break;
          case b: h = ((r - g) / d + 4) / 6; break;
        }
      }

      // Apply hue rotation
      h = (h + hue / 360) % 1;
      if (h < 0) h += 1;

      // Apply saturation (as multiplier, 100% = no change)
      s = Math.min(1, Math.max(0, s * (saturation / 100)));

      // Apply brightness (as multiplier, 100% = no change)
      l = Math.min(1, Math.max(0, l * (brightness / 100)));

      // Convert back to RGB
      let r2, g2, b2;
      if (s === 0) {
        r2 = g2 = b2 = l;
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1/6) return p + (q - p) * 6 * t;
          if (t < 1/2) return q;
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
          return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r2 = hue2rgb(p, q, h + 1/3);
        g2 = hue2rgb(p, q, h);
        b2 = hue2rgb(p, q, h - 1/3);
      }

      // Convert to hex
      const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
      return `#${toHex(r2)}${toHex(g2)}${toHex(b2)}`;
    }

    window.resetFilters = function() {
      document.getElementById('hueSlider').value = 0;
      document.getElementById('saturationSlider').value = 100;
      document.getElementById('brightnessSlider').value = 100;
      updateFilters();
    };

    window.applyFilters = function() {
      const hue = document.getElementById('hueSlider').value;
      const saturation = document.getElementById('saturationSlider').value;
      const brightness = document.getElementById('brightnessSlider').value;
      
      vscode.postMessage({
        command: 'applyFilters',
        filters: { hue, saturation, brightness }
      });
    };

    // Toggle code sections
    window.toggleCodeSection = function(containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.classList.toggle('collapsed');
      }
    };

    // Calculate filters by comparing original and current colors
    function calculateFiltersFromColors(origColors, currColors) {
      if (!origColors || !currColors || origColors.length === 0 || currColors.length === 0) {
        return { hue: 0, saturation: 100, brightness: 100 };
      }

      // Helper to convert color to HSL
      function colorToHsl(color) {
        let r, g, b;
        if (color.startsWith('#')) {
          const hex = color.slice(1);
          if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16) / 255;
            g = parseInt(hex[1] + hex[1], 16) / 255;
            b = parseInt(hex[2] + hex[2], 16) / 255;
          } else {
            r = parseInt(hex.slice(0, 2), 16) / 255;
            g = parseInt(hex.slice(2, 4), 16) / 255;
            b = parseInt(hex.slice(4, 6), 16) / 255;
          }
        } else if (color.startsWith('rgb')) {
          const match = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
          if (match) {
            r = parseInt(match[1]) / 255;
            g = parseInt(match[2]) / 255;
            b = parseInt(match[3]) / 255;
          } else {
            return null;
          }
        } else {
          return null;
        }

        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return { h: h * 360, s, l };
      }

      // Find a non-white/black color to compare (more reliable for hue detection)
      let bestOrigIdx = -1;
      let bestSaturation = 0;
      for (let i = 0; i < origColors.length && i < currColors.length; i++) {
        const origHsl = colorToHsl(origColors[i]);
        if (origHsl && origHsl.s > bestSaturation && origHsl.l > 0.1 && origHsl.l < 0.9) {
          bestSaturation = origHsl.s;
          bestOrigIdx = i;
        }
      }

      if (bestOrigIdx === -1) bestOrigIdx = 0;

      const origHsl = colorToHsl(origColors[bestOrigIdx]);
      const currHsl = colorToHsl(currentColors[bestOrigIdx]);

      if (!origHsl || !currHsl) {
        return { hue: 0, saturation: 100, brightness: 100 };
      }

      // Calculate hue difference
      let hueDiff = currHsl.h - origHsl.h;
      if (hueDiff < 0) hueDiff += 360;
      if (hueDiff > 180) hueDiff -= 360; // Normalize to -180 to 180

      // Calculate saturation ratio
      let satRatio = origHsl.s > 0.01 ? (currHsl.s / origHsl.s) * 100 : 100;
      satRatio = Math.round(Math.min(200, Math.max(0, satRatio)));

      // Calculate brightness ratio
      let briRatio = origHsl.l > 0.01 ? (currHsl.l / origHsl.l) * 100 : 100;
      briRatio = Math.round(Math.min(200, Math.max(0, briRatio)));

      return {
        hue: Math.round(hueDiff),
        saturation: satRatio,
        brightness: briRatio
      };
    }
    
    // Initialize saved animation UI on load and apply to preview
    document.addEventListener('DOMContentLoaded', () => {
      // Calculate filters from color difference between original and current
      const calculatedFilters = calculateFiltersFromColors(originalColors, currentColors);
      
      if (calculatedFilters.hue !== 0 || calculatedFilters.saturation !== 100 || calculatedFilters.brightness !== 100) {
        document.getElementById('hueSlider').value = calculatedFilters.hue;
        document.getElementById('hueValue').textContent = calculatedFilters.hue + 'deg';
        document.getElementById('saturationSlider').value = calculatedFilters.saturation;
        document.getElementById('saturationValue').textContent = calculatedFilters.saturation + '%';
        document.getElementById('brightnessSlider').value = calculatedFilters.brightness;
        document.getElementById('brightnessValue').textContent = calculatedFilters.brightness + '%';
        
        // Mark filters as calculated (informative only, colors already transformed)
        filtersAreCalculated = true;
        
        // Don't apply CSS filter - colors are already transformed
        // Just update the swatches display
      }
      
      // Also check for inline CSS filter (fallback)
      const container = document.getElementById('zoomContainer');
      if (container) {
        const svg = container.querySelector('svg');
        if (svg) {
          // Try to get filter from style property or style attribute
          let filter = svg.style.filter || '';
          if (!filter) {
            const styleAttr = svg.getAttribute('style') || '';
            const filterMatch = styleAttr.match(/filter:\s*([^;]+)/i);
            if (filterMatch) {
              filter = filterMatch[1];
            }
          }
          
          if (filter) {
            const hueMatch = filter.match(/hue-rotate\((-?[\d.]+)deg\)/);
            if (hueMatch) {
              document.getElementById('hueSlider').value = hueMatch[1];
              document.getElementById('hueValue').textContent = hueMatch[1] + 'deg';
            }
            
            const satMatch = filter.match(/saturate\(([\d.]+)%?\)/);
            if (satMatch) {
              // Handle both 1.5 (multiplier) and 150% formats
              let satValue = parseFloat(satMatch[1]);
              if (satValue <= 2 && !satMatch[0].includes('%')) {
                satValue = satValue * 100; // Convert multiplier to percentage
              }
              document.getElementById('saturationSlider').value = satValue;
              document.getElementById('saturationValue').textContent = satValue + '%';
            }
            
            const briMatch = filter.match(/brightness\(([\d.]+)%?\)/);
            if (briMatch) {
              // Handle both 1.5 (multiplier) and 150% formats
              let briValue = parseFloat(briMatch[1]);
              if (briValue <= 2 && !briMatch[0].includes('%')) {
                briValue = briValue * 100; // Convert multiplier to percentage
              }
              document.getElementById('brightnessSlider').value = briValue;
              document.getElementById('brightnessValue').textContent = briValue + '%';
            }
            
            // Apply filters to swatches on load
            updateFilters();
          }
        }
      }

      if (currentAnimation !== 'none') {
        // Update UI elements
        document.querySelectorAll('.animation-type-btn').forEach(btn => {
          btn.classList.remove('active');
          if (btn.getAttribute('data-type') === currentAnimation) {
            btn.classList.add('active');
          }
        });
        
        // Show correct category for the animation
        const drawAnims = ['draw', 'draw-reverse', 'draw-loop'];
        const attentionAnims = ['shake', 'shake-vertical', 'swing', 'wobble', 'rubber-band', 'jello', 'heartbeat', 'tada'];
        const entranceAnims = ['fade-in', 'fade-out', 'zoom-in', 'zoom-out', 'slide-in-up', 'slide-in-down', 'slide-in-left', 'slide-in-right', 'flip', 'flip-x'];
        
        let category = 'basic';
        if (drawAnims.includes(currentAnimation)) category = 'draw';
        else if (attentionAnims.includes(currentAnimation)) category = 'attention';
        else if (entranceAnims.includes(currentAnimation)) category = 'entrance';
        
        showAnimCategory(category);
        
        // Update export button
        const copyBtn = document.getElementById('copyAnimBtn');
        const hint = document.querySelector('.export-hint');
        if (copyBtn) {
          copyBtn.disabled = false;
          hint.textContent = i18n.svgWillIncludeAnimation;
        }
        
        // Update settings UI
        const durationEl = document.getElementById('animDuration');
        const durationValueEl = document.getElementById('animDurationValue');
        const delayEl = document.getElementById('animDelay');
        const delayValueEl = document.getElementById('animDelayValue');
        const timingEl = document.getElementById('animTiming');
        const iterationEl = document.getElementById('animIteration');
        const directionEl = document.getElementById('animDirection');
        
        if (durationEl) durationEl.value = animationSettings.duration;
        if (durationValueEl) durationValueEl.textContent = animationSettings.duration + 's';
        if (delayEl) delayEl.value = animationSettings.delay;
        if (delayValueEl) delayValueEl.textContent = animationSettings.delay + 's';
        if (timingEl) timingEl.value = animationSettings.timing;
        if (iterationEl) iterationEl.value = animationSettings.iteration;
        if (directionEl) directionEl.value = animationSettings.direction;
        
        // Show restart animation button and indicator
        const restartBtn = document.getElementById('restartAnimBtn');
        if (restartBtn) restartBtn.style.display = 'flex';
        const animIndicator = document.getElementById('animationIndicator');
        if (animIndicator) animIndicator.style.display = 'flex';
        
        // Apply the saved animation to the preview
        updateAnimationPreview();
      }
    });
    
    function updateZoom() {
      const zoomContainer = document.getElementById('zoomContainer');
      const zoomLevel = document.getElementById('zoomLevel');
      
      const scale = zoomLevels[currentZoom - 1] / 100;
      if (zoomContainer) zoomContainer.style.transform = 'scale(' + scale + ')';
      zoomLevel.textContent = zoomLevels[currentZoom - 1] + '%';
    }
    
    function zoomIn() {
      if (currentZoom < 5) { currentZoom++; updateZoom(); }
    }
    
    function zoomOut() {
      if (currentZoom > 1) { currentZoom--; updateZoom(); }
    }
    
    function resetZoom() {
      currentZoom = 3; updateZoom();
    }
    
    let includeAnimationInCode = false;
    
    function copySvgCode() {
      // Get text from code editor rows
      const rows = document.querySelectorAll('#svgCodeTab .code-row .cl');
      const code = Array.from(rows).map(row => row.textContent).join('\n');
      navigator.clipboard.writeText(code).then(() => {
        vscode.postMessage({ command: 'showMessage', message: i18n.svgCodeCopied });
      });
    }
    
    function copyAnimationCode() {
      const rows = document.querySelectorAll('#animationCodeTab .code-row .cl');
      const code = Array.from(rows).map(row => row.textContent).join('\n');
      navigator.clipboard.writeText(code).then(() => {
        vscode.postMessage({ command: 'showMessage', message: i18n.animationCssCopied });
      });
    }
    
    function copyUsageCode() {
      const rows = document.querySelectorAll('#usageCodeTab .code-row .cl');
      const code = Array.from(rows).map(row => row.textContent).join('\n');
      navigator.clipboard.writeText(code).then(() => {
        vscode.postMessage({ command: 'showMessage', message: i18n.usageCodeCopied });
      });
    }
    
    // Insert usage code at the active editor cursor
    function insertUsageCode() {
      const rows = document.querySelectorAll('#usageCodeTab .code-row .cl');
      // Get first non-comment line (the actual usage code)
      let code = '';
      for (const row of rows) {
        const text = row.textContent?.trim() || '';
        if (text && !text.startsWith('<!--') && !text.startsWith('//')) {
          code = text;
          break;
        }
      }
      if (code) {
        vscode.postMessage({ command: 'insertCodeAtCursor', code });
      }
    }
    
    function updateAnimationCodeSection() {
      const section = document.getElementById('animationCodeSection');
      const badge = document.getElementById('animationTypeBadge');
      if (section) {
        section.style.display = currentAnimation !== 'none' ? '' : 'none';
      }
      if (badge) {
        badge.textContent = currentAnimation;
      }
      // Request updated animation code from backend
      vscode.postMessage({
        command: 'updateAnimationCode',
        animation: currentAnimation,
        settings: animationSettings
      });
    }
    
    function toggleAnimationInCode(checked) {
      includeAnimationInCode = checked;
      vscode.postMessage({ 
        command: 'updateCodeWithAnimation', 
        includeAnimation: checked,
        animation: currentAnimation,
        settings: animationSettings
      });
    }
    
    function updateAnimationToggleVisibility() {
      // Update animation code section visibility
      updateAnimationCodeSection();
    }
    
    function updateCodeView(newSvg) {
      // Refresh code view
      vscode.postMessage({ 
        command: 'updateCodeWithAnimation', 
        includeAnimation: includeAnimationInCode,
        animation: currentAnimation,
        settings: animationSettings
      });
    }

    function toHexColor(color) {
      // Handle named colors using a canvas
      if (color.startsWith('#')) {
        // Expand short hex to full hex
        if (color.length === 4) {
          return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
        }
        return color;
      }
      // Use canvas to convert named colors to hex
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.fillStyle = color;
      return ctx.fillStyle; // Returns hex color
    }
    
    let colorChangeTimeout = null;
    let lastColorChange = { oldColor: null, newColor: null };
    
    // Preview color change in real-time (while dragging)
    window.previewColor = function(oldColor, newColor) {
      // Update swatch background immediately for visual feedback
      const input = window.event ? window.event.target : null;
      if (input && input.parentElement) {
        input.parentElement.style.backgroundColor = newColor;
      }
      
      // Debounce the preview update
      lastColorChange = { oldColor, newColor };
      
      if (colorChangeTimeout) {
        clearTimeout(colorChangeTimeout);
      }
      
      colorChangeTimeout = setTimeout(() => {
        vscode.postMessage({ command: 'previewColor', oldColor: lastColorChange.oldColor, newColor: lastColorChange.newColor });
        colorChangeTimeout = null;
      }, 30);
    };
    
    // Apply color change (when picker closes)
    window.changeColor = function(oldColor, newColor) {
      if (colorChangeTimeout) {
        clearTimeout(colorChangeTimeout);
        colorChangeTimeout = null;
      }
      vscode.postMessage({ command: 'changeColor', oldColor, newColor });
    };
    
    // Replace currentColor with a specific color
    window.replaceCurrentColor = function(newColor) {
      vscode.postMessage({ command: 'replaceCurrentColor', newColor });
    };
    
    // Show color picker to add a new fill color
    function showAddColorPicker() {
      // Create temporary color picker input
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.value = '#4fc1ff';
      picker.style.position = 'absolute';
      picker.style.opacity = '0';
      document.body.appendChild(picker);
      
      picker.addEventListener('change', () => {
        vscode.postMessage({ command: 'addFillColor', color: picker.value });
        document.body.removeChild(picker);
      });
      
      picker.addEventListener('blur', () => {
        setTimeout(() => {
          if (document.body.contains(picker)) {
            document.body.removeChild(picker);
          }
        }, 100);
      });
      
      picker.click();
    }
    
    // Variant functions
    function saveVariant() {
      try {
        console.log('[IconWrap IconEditor JS] saveVariant called');
        vscode.postMessage({ command: 'saveVariant' });
        console.log('[IconWrap IconEditor JS] postMessage sent');
      } catch (e) {
        console.error('[IconWrap IconEditor JS] Error in saveVariant:', e);
      }
    }
    
    function generateAutoVariant(type) {
      console.log('[IconWrap IconEditor JS] generateAutoVariant called:', type);
      vscode.postMessage({ command: 'generateAutoVariant', type });
    }
    
    function applyVariant(index) {
      vscode.postMessage({ command: 'applyVariant', index });
    }
    
    function applyDefaultVariant() {
      vscode.postMessage({ command: 'applyDefaultVariant' });
    }
    
    function setDefaultVariant(variantName) {
      vscode.postMessage({ command: 'setDefaultVariant', variantName });
    }
    
    function deleteVariant(index) {
      vscode.postMessage({ command: 'deleteVariant', index });
    }
    
    function editVariant(index) {
      vscode.postMessage({ command: 'editVariant', index });
    }

    function persistVariants() {
      vscode.postMessage({ command: 'persistVariants' });
    }
    
    function optimizeSvg(preset) {
      const btn = document.getElementById('optimizeBtn');
      if (btn && btn.classList.contains('optimized')) return;
      
      vscode.postMessage({ command: 'optimizeSvg', preset });
    }
    
    function resetOptimization() {
      const btn = document.getElementById('optimizeBtn');
      if (btn) {
        btn.classList.remove('optimized');
        btn.title = i18n.optimizeSvgo;
      }
      const resultBar = document.getElementById('optimizeResultBar');
      if (resultBar) resultBar.style.display = 'none';
      
      const revertBtn = document.getElementById('btnRevertOptimized');
      if (revertBtn) revertBtn.style.display = 'none';
    }

    function applyOptimized() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'applyOptimizedSvg', svg: optimizedSvg });
      }
    }
    
    function copyOptimized() {
      if (optimizedSvg) {
        vscode.postMessage({ command: 'copySvg', svg: optimizedSvg });
      }
    }
    
    function rebuild() {
      // Check if there are active filters that need to be applied first
      // BUT only if they were manually changed (not just calculated from existing colors)
      const hue = parseInt(document.getElementById('hueSlider')?.value || '0');
      const saturation = parseInt(document.getElementById('saturationSlider')?.value || '100');
      const brightness = parseInt(document.getElementById('brightnessSlider')?.value || '100');
      const hasActiveFilters = hue !== 0 || saturation !== 100 || brightness !== 100;
      
      // Check if there's pending optimization
      const hasPendingOptimization = optimizedSvg !== null;
      
      vscode.postMessage({ command: 'log', message: `[Rebuild] hasActiveFilters=${hasActiveFilters}, filtersAreCalculated=${filtersAreCalculated}, hasPendingOptimization=${hasPendingOptimization}` });
      
      // Only apply filters if user manually changed them (not calculated)
      if (hasActiveFilters && !filtersAreCalculated) {
        vscode.postMessage({ command: 'log', message: '[Rebuild] Applying filters before rebuild' });
        // Apply filters first, then rebuild
        vscode.postMessage({
          command: 'applyFilters',
          filters: { hue: String(hue), saturation: String(saturation), brightness: String(brightness) },
          thenRebuild: true,
          applyOptimization: hasPendingOptimization,
          animation: currentAnimation !== 'none' ? currentAnimation : null,
          animationSettings: currentAnimation !== 'none' ? animationSettings : null
        });
      } else {
        vscode.postMessage({ command: 'log', message: '[Rebuild] Direct rebuild (no filter application)' });
        // Filters are calculated (informative) or no filters - colors already correct
        vscode.postMessage({ 
          command: 'rebuild',
          applyOptimization: hasPendingOptimization,
          animation: currentAnimation !== 'none' ? currentAnimation : null,
          animationSettings: currentAnimation !== 'none' ? animationSettings : null
        });
      }
    }
    
    function copySvg() {
      const svg = document.querySelector('.preview-box svg');
      vscode.postMessage({ 
        command: 'copySvg', 
        svg: svg?.outerHTML,
        animation: currentAnimation !== 'none' ? currentAnimation : null,
        animationSettings: currentAnimation !== 'none' ? animationSettings : null
      });
    }
    
    function renameIcon() {
      const currentName = document.getElementById('iconName').textContent;
      vscode.postMessage({ command: 'requestRename', currentName: currentName });
    }

    window.addEventListener('message', event => {
      const message = event.data;
      
      if (message.command === 'applyOptimizationBeforeRebuild') {
        // Server wants us to apply optimization before rebuild
        if (optimizedSvg) {
          applyOptimized();
        }
      }
      
      if (message.command === 'previewUpdated') {
        // Only update SVG preview, don't touch swatches (picker is open)
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
      }
      
      if (message.command === 'nameUpdated') {
        // Update the name in the header
        document.getElementById('iconName').textContent = message.newName;
      }
      
      if (message.command === 'colorChanged') {
        resetOptimizationButtons();
        // Update preview
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
        
        // Update color swatches
        if (message.colors) {
          const swatchesContainer = document.querySelector('.color-swatches');
          if (swatchesContainer) {
            let swatchesHtml = '';
            
            if (message.hasCurrentColor) {
              swatchesHtml += `
                <div class="current-color-badge">
                  <span class="codicon codicon-paintcan"></span>
                  Uses <code>currentColor</code>
                </div>
              `;
            }
            
            if (message.colors.length > 0) {
              message.colors.forEach(color => {
                const hexColor = toHexColor(color);
                swatchesHtml += `
                  <div class="color-item">
                    <div class="color-swatch" style="background-color: \${color}" title="\${color}">
                      <input type="color" value="\${hexColor}" 
                        oninput="previewColor('\${color}', this.value)" 
                        onchange="applyColor('\${color}', this.value)" 
                        data-original="\${color}" />
                    </div>
                  </div>
                `;
              });
            } else if (!message.hasCurrentColor) {
              swatchesHtml += '<span class="no-colors">' + i18n.noColorsDetected + '</span>';
            }
            
            swatchesHtml += `
              <button class="add-color-btn" onclick="addColor()" title="${i18n.addFillColor}">
                <span class="codicon codicon-add"></span>
              </button>
            `;
            
            swatchesContainer.innerHTML = swatchesHtml;
          }
        }
      }
      
      if (message.command === 'optimizeResult') {
        optimizedSvg = message.svg;
        
        // Show result bar
        const resultBar = document.getElementById('optimizeResultBar');
        if (resultBar) {
          resultBar.style.display = 'flex';
        }
        
        // Update savings badge
        const savingsText = document.getElementById('optimizeSavingsText');
        if (savingsText) {
          if (message.savingsPercent > 0) {
            savingsText.textContent = '-' + message.savingsPercent.toFixed(1) + '%';
            savingsText.classList.remove('no-savings');
          } else {
            savingsText.textContent = i18n.optimal;
            savingsText.classList.add('no-savings');
          }
        }
        
        // Update size text
        const sizeText = document.getElementById('optimizeSizeText');
        if (sizeText) {
          sizeText.textContent = message.originalSizeStr + ' → ' + message.optimizedSizeStr;
        }
        
        // Show/hide build hint based on savings
        const buildHint = document.getElementById('optimizeBuildHint');
        if (buildHint) {
          buildHint.style.display = message.savingsPercent > 0 ? 'flex' : 'none';
        }
        
        // Mark optimize button if already optimal
        if (message.savingsPercent <= 0) {
          const optimizeBtn = document.getElementById('optimizeBtn');
          if (optimizeBtn) {
            optimizeBtn.classList.add('optimized');
            optimizeBtn.title = i18n.alreadyOptimized;
          }
        }
      }

      if (message.command === 'optimizedSvgApplied') {
        // Clear pending optimization
        optimizedSvg = null;
        
        // Update preview
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
        
        // Update code tab
        const codeEl = document.getElementById('svgCodeTab');
        if (codeEl) {
          codeEl.innerHTML = message.code;
        }
        
        // Update header file size
        const fileSizeEl = document.getElementById('fileSize');
        if (fileSizeEl) {
          const newSize = new Blob([message.svg]).size;
          const newSizeStr = newSize < 1024 ? newSize + ' B' : (newSize / 1024).toFixed(1) + ' KB';
          fileSizeEl.textContent = newSizeStr;
        }

        // Show optimized badge
        const optimizedBadge = document.getElementById('optimizedBadge');
        if (optimizedBadge) {
          optimizedBadge.style.display = 'inline-flex';
        }

        // Mark optimize button as optimized
        const optimizeBtn = document.getElementById('optimizeBtn');
        if (optimizeBtn) {
          optimizeBtn.classList.add('optimized');
          optimizeBtn.title = i18n.alreadyOptimized;
        }

        // Hide build hint, show revert button
        const buildHint = document.getElementById('optimizeBuildHint');
        if (buildHint) buildHint.style.display = 'none';
        
        const revertBtn = document.getElementById('btnRevertOptimized');
        if (revertBtn) revertBtn.style.display = 'flex';
      }
      
      if (message.command === 'optimizationReverted') {
        // Update preview
        const container = document.getElementById('zoomContainer');
        if (container) container.innerHTML = message.svg;
        
        // Update code tab
        const codeEl = document.getElementById('svgCodeTab');
        if (codeEl) {
          codeEl.innerHTML = message.code;
        }
        
        // Update header file size
        const fileSizeEl = document.getElementById('fileSize');
        if (fileSizeEl) {
          const newSize = new Blob([message.svg]).size;
          const newSizeStr = newSize < 1024 ? newSize + ' B' : (newSize / 1024).toFixed(1) + ' KB';
          fileSizeEl.textContent = newSizeStr;
        }

        // Hide optimized badge
        const optimizedBadge = document.getElementById('optimizedBadge');
        if (optimizedBadge) {
          optimizedBadge.style.display = 'none';
        }

        // Reset optimization UI
        resetOptimization();
      }

      if (message.command === 'updateVariantselection') {
        resetOptimization();
        document.querySelectorAll('.variant-item').forEach((el, idx) => {
          if (idx === message.selectedIndex) {
            el.classList.add('selected');
          } else {
            el.classList.remove('selected');
          }
        });
      }

      // Update variant color dots after color/filter changes
      if (message.command === 'variantColorsUpdated') {
        const variantIndex = message.variantIndex;
        const colors = message.colors;
        // variantIndex 0 = original (index -1), 1 = first custom (index 0), etc.
        const adjustedIndex = variantIndex + 1; // +1 because original is at index 0 in DOM
        const variantItems = document.querySelectorAll('.variant-item');
        if (variantItems[adjustedIndex]) {
          const dotsContainer = variantItems[adjustedIndex].querySelector('.variant-colors');
          if (dotsContainer) {
            const dotsHtml = colors.slice(0, 4).map(c => 
              `<div class="variant-color-dot" style="background:${c}" title="${c}"></div>`
            ).join('');
            dotsContainer.innerHTML = dotsHtml;
          }
        }
      }
      
      if (message.command === 'updateCodeTab') {
        // Update SVG code tab
        const codeEl = document.getElementById('svgCodeTab');
        if (codeEl) {
          codeEl.innerHTML = message.code;
        }
        
        // Update file size if provided
        if (message.size !== undefined) {
          const fileSizeEl = document.getElementById('fileSize');
          if (fileSizeEl) {
            const newSize = message.size;
            const newSizeStr = newSize < 1024 ? newSize + ' B' : (newSize / 1024).toFixed(1) + ' KB';
            fileSizeEl.textContent = newSizeStr;
          }
        }
      }
      
      if (message.command === 'animationCodeUpdated') {
        // Update animation code section
        const animCodeEl = document.getElementById('animationCodeTab');
        const animSection = document.getElementById('animationCodeSection');
        const badge = document.getElementById('animationTypeBadge');
        
        if (animCodeEl) {
          animCodeEl.innerHTML = message.code;
        }
        if (animSection) {
          animSection.style.display = message.animationType && message.animationType !== 'none' ? '' : 'none';
        }
        if (badge) {
          badge.textContent = message.animationType || 'none';
        }
      }
    });
    
    // Tab switching
    function switchTab(tabName) {
      // Update tab buttons
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.onclick.toString().includes(tabName)) {
          btn.classList.add('active');
        }
      });
      
      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById('tab-' + tabName).classList.add('active');
    }
    
    // Animation functions
    function setAnimation(type) {
      currentAnimation = type;
      
      // Update active button
      document.querySelectorAll('.animation-type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-type') === type) {
          btn.classList.add('active');
        }
      });
      
      // Update export button state
      const copyBtn = document.getElementById('copyAnimBtn');
      const hint = document.querySelector('.export-hint');
      if (type === 'none') {
        copyBtn.disabled = true;
        hint.textContent = i18n.selectAnimationToEnable;
      } else {
        copyBtn.disabled = false;
        hint.textContent = i18n.svgWillIncludeAnimation;
      }
      
      // Show/hide restart animation button and indicator
      const restartBtn = document.getElementById('restartAnimBtn');
      if (restartBtn) {
        restartBtn.style.display = type === 'none' ? 'none' : 'flex';
      }
      const animIndicator = document.getElementById('animationIndicator');
      if (animIndicator) {
        animIndicator.style.display = type === 'none' ? 'none' : 'flex';
      }
      
      // Update animation toggle visibility in code tab
      updateAnimationToggleVisibility();
      
      // Update code if animation is included
      if (includeAnimationInCode) {
        updateCodeView();
      }
      
      // Update preview
      updateAnimationPreview();
    }
    
    function restartAnimation() {
      if (currentAnimation === 'none') return;
      
      const svg = document.querySelector('.preview-box svg');
      if (!svg) return;
      
      // Remove all animation classes
      svg.classList.forEach(cls => {
        if (cls.startsWith('anim-')) {
          svg.classList.remove(cls);
        }
      });
      
      // Reset inline styles for draw animations
      const pathElements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
      pathElements.forEach(el => {
        el.style.animation = '';
        el.style.strokeDasharray = '';
        el.style.strokeDashoffset = '';
      });
      
      // Force reflow to restart animation
      void svg.offsetWidth;
      
      // Small delay to ensure DOM updates
      setTimeout(() => {
        updateAnimationPreview();
      }, 10);
    }
    
    function copyWithAnimation() {
      if (currentAnimation === 'none') return;
      
      vscode.postMessage({
        command: 'copyWithAnimation',
        animation: currentAnimation,
        settings: animationSettings
      });
    }
    
    function saveAnimation() {
      vscode.postMessage({
        command: 'saveAnimation',
        animation: currentAnimation,
        settings: currentAnimation !== 'none' ? animationSettings : null
      });
    }
    
    function updateAnimationSetting(setting, value) {
      animationSettings[setting] = value;
      
      if (setting === 'duration') {
        document.getElementById('durationValue').textContent = value + 's';
      }
      if (setting === 'delay') {
        document.getElementById('delayValue').textContent = value + 's';
      }
      
      updateAnimationPreview();
      
      // Update code view if animation is included
      if (includeAnimationInCode) {
        updateCodeView();
      }
    }
    
    function updateAnimationPreview() {
      // Update header badge
      const animBadge = document.getElementById('animBadge');
      const animName = document.getElementById('animName');
      if (animBadge && animName) {
        if (currentAnimation !== 'none') {
          animBadge.style.display = 'inline-flex';
          animName.textContent = currentAnimation;
        } else {
          animBadge.style.display = 'none';
        }
      }

      // Apply animation to main preview
      const previewBox = document.getElementById('previewBox');
      const svg = previewBox.querySelector('svg');
      if (!svg) return;
      
      // Remove all animation classes
      const animClasses = ['anim-spin', 'anim-spin-reverse', 'anim-pulse', 'anim-pulse-grow', 
        'anim-bounce', 'anim-bounce-horizontal', 'anim-shake', 'anim-shake-vertical', 
        'anim-fade', 'anim-fade-in', 'anim-fade-out', 'anim-float', 'anim-swing', 
        'anim-flip', 'anim-flip-x', 'anim-heartbeat', 'anim-wobble', 'anim-rubber-band', 
        'anim-jello', 'anim-tada', 'anim-zoom-in', 'anim-zoom-out', 
        'anim-slide-in-up', 'anim-slide-in-down', 'anim-slide-in-left', 'anim-slide-in-right',
        'anim-blink', 'anim-glow', 'anim-draw', 'anim-draw-reverse', 'anim-draw-loop'];
      animClasses.forEach(cls => svg.classList.remove(cls));
      
      // Reset path styles for draw animations
      const pathElements = svg.querySelectorAll('path, line, polyline, polygon, circle, ellipse, rect');
      pathElements.forEach(el => {
        el.style.removeProperty('--path-length');
        el.style.removeProperty('stroke-dasharray');
        el.style.removeProperty('stroke-dashoffset');
        el.style.removeProperty('animation');
      });
      
      // Set CSS variables for animation settings
      svg.style.setProperty('--anim-duration', animationSettings.duration + 's');
      svg.style.setProperty('--anim-timing', animationSettings.timing);
      svg.style.setProperty('--anim-iteration', animationSettings.iteration);
      svg.style.setProperty('--anim-delay', animationSettings.delay + 's');
      svg.style.setProperty('--anim-direction', animationSettings.direction);
      
      // Add new animation class
      if (currentAnimation !== 'none') {
        svg.classList.add('anim-' + currentAnimation);
        
        // For draw animations, calculate actual path lengths
        if (currentAnimation === 'draw' || currentAnimation === 'draw-reverse' || currentAnimation === 'draw-loop') {
          pathElements.forEach(el => {
            let pathLength = 100; // Default fallback
            try {
              if (typeof el.getTotalLength === 'function') {
                pathLength = el.getTotalLength();
              }
            } catch (e) {
              // Some elements don't support getTotalLength
            }
            el.style.setProperty('--path-length', pathLength.toString());
            el.style.strokeDasharray = pathLength.toString();
            
            // Set initial state and animation based on type
            const duration = animationSettings.duration + 's';
            const timing = animationSettings.timing;
            const delay = animationSettings.delay + 's';
            const iteration = animationSettings.iteration;
            
            if (currentAnimation === 'draw') {
              el.style.strokeDashoffset = pathLength.toString();
              el.style.animation = 'draw ' + duration + ' ' + timing + ' ' + delay + ' forwards';
            } else if (currentAnimation === 'draw-reverse') {
              el.style.strokeDashoffset = '0';
              el.style.animation = 'draw-reverse ' + duration + ' ' + timing + ' ' + delay + ' forwards';
            } else if (currentAnimation === 'draw-loop') {
              el.style.strokeDashoffset = pathLength.toString();
              el.style.animation = 'draw-loop ' + duration + ' ' + timing + ' ' + delay + ' ' + iteration;
            }
          });
        }
      }
    }
    
    // Animation category switching
    function showAnimCategory(category) {
      // Update category buttons
      document.querySelectorAll('.anim-category-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-category') === category) {
          btn.classList.add('active');
        }
      });
      
      // Show/hide category sections
      document.querySelectorAll('.anim-category-section').forEach(section => {
        section.style.display = 'none';
      });
      document.getElementById('category-' + category).style.display = 'block';
    }
    
    // Initialize animation type button
    document.querySelector('.animation-type-btn[data-type="none"]')?.classList.add('active');

    // Expose functions to global scope for HTML onclick handlers
    window.zoomIn = zoomIn;
    window.zoomOut = zoomOut;
    window.resetZoom = resetZoom;
    window.copySvgCode = copySvgCode;
    window.copyAnimationCode = copyAnimationCode;
    window.copyUsageCode = copyUsageCode;
    window.insertUsageCode = insertUsageCode;
    window.toggleCodeSection = toggleCodeSection;
    window.optimizeSvg = optimizeSvg;
    window.rebuild = rebuild;
    window.copySvg = copySvg;
    window.saveVariant = saveVariant;
    window.deleteVariant = deleteVariant;
    window.setDefaultVariant = setDefaultVariant;
    window.setAnimation = setAnimation;
    window.restartAnimation = restartAnimation;
    window.updateAnimationPreview = updateAnimationPreview;
    window.showAnimCategory = showAnimCategory;
    window.switchTab = switchTab;
    window.applyVariant = applyVariant;
    window.applyOptimized = applyOptimized;
    window.copyOptimized = copyOptimized;
    window.generateAutoVariant = generateAutoVariant;
    window.applyDefaultVariant = applyDefaultVariant;
    window.editVariant = editVariant;
    window.renameIcon = renameIcon;
    window.showAddColorPicker = showAddColorPicker;
    window.toggleAnimationInCode = toggleAnimationInCode;
    window.copyWithAnimation = copyWithAnimation;
    window.saveAnimation = saveAnimation;
    window.updateAnimationSetting = updateAnimationSetting;
})();
