(function() {
    const vscode = acquireVsCodeApi();

    // i18n translations injected from TypeScript
    const i18n = __I18N__;

    let currentZoom = 3;
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
    const iconName = __ICON_NAME__;

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

    // Toggle code sections
    window.toggleCodeSection = function(containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        container.classList.toggle('collapsed');
      }
    };

    // Initialize saved animation UI on load and apply to preview
    document.addEventListener('DOMContentLoaded', () => {
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
      // Update the data-original-color to the new color
      const colorItems = document.querySelectorAll('.color-item');
      colorItems.forEach(item => {
        const input = item.querySelector('input[type="color"]');
        const label = item.querySelector('.color-label');
        const swatch = item.querySelector('.color-swatch');
        if (input && input.dataset.originalColor === oldColor) {
          input.dataset.originalColor = newColor;
          if (label) {
            label.textContent = newColor;
            label.style.color = '';
            label.title = '';
          }
          if (swatch) {
            swatch.style.backgroundColor = newColor;
          }
        }
      });

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
        vscode.postMessage({ command: 'saveVariant' });
      } catch (e) {
        console.error('[Icon Studio IconEditor JS] Error in saveVariant:', e);
      }
    }

    function generateAutoVariant(type) {
      vscode.postMessage({ command: 'generateAutoVariant', type });
    }

    function applyVariant(index) {
      vscode.postMessage({ command: 'applyVariant', index });
    }

    function applyDefaultVariant() {
      vscode.postMessage({ command: 'applyDefaultVariant' });
    }

    function setDefaultVariant(variantName) {
      // Default-variant setting removed; no-op to avoid sending messages
      console.debug('[IconEditor] setDefaultVariant called but feature removed');
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

    function rebuild() {
      vscode.postMessage({
        command: 'rebuild',
        animation: currentAnimation !== 'none' ? currentAnimation : null,
        animationSettings: currentAnimation !== 'none' ? animationSettings : null
      });
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
                const escapedColor = color.replace(/'/g, "\\'").replace(/"/g, '\\"');
                swatchesHtml += `
                  <div class="color-item" title="Click to change color">
                    <div class="color-swatch" style="background-color: ${color}">
                      <input type="color" value="${hexColor}"
                        data-original-color="${escapedColor}"
                        onchange="changeColor('${escapedColor}', this.value)"
                        oninput="previewColor('${escapedColor}', this.value)" />
                    </div>
                    <span class="color-label" onclick="copyToClipboard('${escapedColor}')" title="Click to copy: ${color}">${color}</span>
                  </div>
                `;
              });
            } else if (!message.hasCurrentColor) {
              swatchesHtml += '<span class="no-colors">' + (i18n.noColorsDetected || 'No colors detected') + '</span>';
            }

            swatchesContainer.innerHTML = swatchesHtml;
          }
        }
      }

      if (message.command === 'updateVariantselection') {
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

      // Update export button state (elements may not exist)
      const copyBtn = document.getElementById('copyAnimBtn');
      const hint = document.querySelector('.export-hint');
      if (copyBtn) {
        copyBtn.disabled = type === 'none';
      }
      if (hint) {
        hint.textContent = type === 'none' ? i18n.selectAnimationToEnable : i18n.svgWillIncludeAnimation;
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
    window.generateAutoVariant = generateAutoVariant;
    window.applyDefaultVariant = applyDefaultVariant;
    window.editVariant = editVariant;
    window.renameIcon = renameIcon;
    window.showAddColorPicker = showAddColorPicker;
    window.toggleAnimationInCode = toggleAnimationInCode;
    window.copyWithAnimation = copyWithAnimation;
    window.saveAnimation = saveAnimation;
    window.updateAnimationSetting = updateAnimationSetting;

    // Custom Animation Presets
    window.saveAsPreset = function() {
      const input = document.getElementById('presetName');
      const name = input?.value?.trim();
      
      if (!name) {
        vscode.postMessage({
          command: 'showMessage',
          message: i18n.enterPresetName || 'Por favor ingresa un nombre para la animación'
        });
        return;
      }

      vscode.postMessage({
        command: 'saveAnimationPreset',
        name: name,
        settings: animationSettings,
        animationType: currentAnimation,
        iconName: iconName
      });
      
      input.value = '';
    };

    window.deleteAnimationPreset = function(name) {
      if (confirm(`¿Eliminar la animación personalizada "${name}"?`)) {
        vscode.postMessage({
          command: 'deleteAnimationPreset',
          name: name,
          iconName: iconName
        });
      }
    };

    window.applyPreset = function(presetData) {
      if (!presetData) return;
      
      currentAnimation = presetData.type || 'none';
      animationSettings = {
        duration: presetData.duration || 1,
        timing: presetData.timing || 'ease-in-out',
        iteration: presetData.iteration || 1,
        delay: presetData.delay || 0,
        direction: presetData.direction || 'normal'
      };

      // Update UI
      document.querySelectorAll('.animation-type-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      document.querySelector(`.animation-type-btn[data-type="${currentAnimation}"]`)?.classList.add('active');

      // Update settings controls
      document.getElementById('animDuration').value = animationSettings.duration;
      document.getElementById('animDurationValue').textContent = animationSettings.duration + 's';
      document.getElementById('animDelay').value = animationSettings.delay;
      document.getElementById('animDelayValue').textContent = animationSettings.delay + 's';
      document.getElementById('animTiming').value = animationSettings.timing;
      document.getElementById('animIteration').value = animationSettings.iteration;
      document.getElementById('animDirection').value = animationSettings.direction;

      // Update preview
      updateAnimationPreview();

      vscode.postMessage({
        command: 'showMessage',
        message: `Animación "${presetData.name}" aplicada`
      });
    };

    window.loadAnimationPresets = function() {
      // Animation presets section removed from UI
    };

    window.displayAnimationPresets = function(presets) {
      // Animation presets section removed from UI
    };

    function escapeHtml(text) {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Load animation presets when animation tab is opened
    window.onAnimationTabOpen = function() {
      // Animation presets section removed from UI
    };

    // Animation presets listener removed - section no longer in UI
})();
