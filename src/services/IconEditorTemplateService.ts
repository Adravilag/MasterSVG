import { getSyntaxHighlighter } from './SyntaxHighlighter';
import { getKeyframesForAnimation } from './AnimationKeyframes';
import { getConfig } from '../utils/configHelper';
import { toVariableName } from '../utils/extensionHelpers';
import { AnimationSettings } from './AnimationService';
import { t } from '../i18n';

/**
 * Animation button configuration
 */
interface AnimationButtonConfig {
  type: string;
  label: string;
  icon: string;
}

/**
 * Animation categories with their buttons
 */
const ANIMATION_BUTTONS: Record<string, AnimationButtonConfig[]> = {
  basic: [
    { type: 'none', label: 'None', icon: 'circle-slash' },
    { type: 'spin', label: 'Spin', icon: 'sync' },
    { type: 'spin-reverse', label: 'Spin ↺', icon: 'sync' },
    { type: 'pulse', label: 'Pulse', icon: 'pulse' },
    { type: 'pulse-grow', label: 'Grow', icon: 'arrow-both' },
    { type: 'bounce', label: 'Bounce', icon: 'triangle-up' },
    { type: 'bounce-horizontal', label: 'Bounce H', icon: 'arrow-right' },
    { type: 'shake', label: 'Shake', icon: 'arrow-swap' },
    { type: 'shake-vertical', label: 'Shake V', icon: 'fold-up' },
    { type: 'fade', label: 'Fade', icon: 'eye' },
    { type: 'float', label: 'Float', icon: 'cloud' },
    { type: 'blink', label: 'Blink', icon: 'lightbulb' },
    { type: 'glow', label: 'Glow', icon: 'sparkle' },
  ],
  attention: [
    { type: 'swing', label: 'Swing', icon: 'triangle-down' },
    { type: 'wobble', label: 'Wobble', icon: 'symbol-event' },
    { type: 'rubber-band', label: 'Rubber', icon: 'fold' },
    { type: 'jello', label: 'Jello', icon: 'beaker' },
    { type: 'heartbeat', label: 'Heartbeat', icon: 'heart' },
    { type: 'tada', label: 'Tada', icon: 'megaphone' },
  ],
  entrance: [
    { type: 'fade-in', label: 'Fade In', icon: 'eye' },
    { type: 'fade-out', label: 'Fade Out', icon: 'eye-closed' },
    { type: 'zoom-in', label: 'Zoom In', icon: 'zoom-in' },
    { type: 'zoom-out', label: 'Zoom Out', icon: 'zoom-out' },
    { type: 'slide-in-up', label: 'Slide ↑', icon: 'arrow-up' },
    { type: 'slide-in-down', label: 'Slide ↓', icon: 'arrow-down' },
    { type: 'slide-in-left', label: 'Slide ←', icon: 'arrow-left' },
    { type: 'slide-in-right', label: 'Slide →', icon: 'arrow-right' },
    { type: 'flip', label: 'Flip Y', icon: 'refresh' },
    { type: 'flip-x', label: 'Flip X', icon: 'fold-up' },
  ],
  draw: [
    { type: 'draw', label: 'Draw', icon: 'edit' },
    { type: 'draw-reverse', label: 'Undraw', icon: 'discard' },
    { type: 'draw-loop', label: 'Draw Loop', icon: 'sync' },
  ],
};

/**
 * Service for generating HTML templates for IconEditorPanel
 * Handles template substitution and HTML generation without panel state dependencies
 */
export class IconEditorTemplateService {
  private static _instance: IconEditorTemplateService;

  private constructor() {}

  public static getInstance(): IconEditorTemplateService {
    if (!IconEditorTemplateService._instance) {
      IconEditorTemplateService._instance = new IconEditorTemplateService();
    }
    return IconEditorTemplateService._instance;
  }

  /**
   * Generate HTML for a single animation button
   */
  public generateAnimationButton(
    type: string,
    label: string,
    icon: string,
    currentType: string
  ): string {
    const isActive = type === currentType;
    return `
      <button class="animation-type-btn${isActive ? ' active' : ''}" data-type="${type}" onclick="setAnimation('${type}')">
        <span class="codicon codicon-${icon}"></span>
        ${label}
      </button>
    `;
  }

  /**
   * Generate all animation buttons for a category
   */
  public generateAnimationButtonsForCategory(
    category: 'basic' | 'attention' | 'entrance' | 'draw',
    currentType: string
  ): string {
    const buttons = ANIMATION_BUTTONS[category];
    if (!buttons) return '';
    return buttons
      .map(btn => this.generateAnimationButton(btn.type, btn.label, btn.icon, currentType))
      .join('');
  }

  /**
   * Generate animation code HTML with syntax highlighting
   */
  public generateAnimationCodeHtml(
    animationType: string,
    settings?: {
      duration?: number;
      timing?: string;
      iteration?: string;
      delay?: number;
      direction?: string;
    }
  ): string {
    if (!animationType || animationType === 'none') {
      return '<div class="code-editor"><div class="code-row"><div class="ln">1</div><div class="cl" style="color: var(--vscode-descriptionForeground); font-style: italic;">No animation selected</div></div></div>';
    }

    const duration = settings?.duration || 1;
    const timing = settings?.timing || 'ease';
    const iteration = settings?.iteration || 'infinite';
    const delay = settings?.delay || 0;
    const direction = settings?.direction || 'normal';

    const keyframes = getKeyframesForAnimation(animationType);
    const animationRule = `.bz-anim-${animationType} {
  animation: ${animationType} ${duration}s ${timing} ${delay}s ${iteration} ${direction};
}`;

    const fullCss = `/* Animation: ${animationType} */
${keyframes}

${animationRule}`;

    return getSyntaxHighlighter().highlightCssCode(fullCss);
  }

  /**
   * Generate usage code HTML with syntax highlighting
   */
  public generateUsageCodeHtml(iconName: string, animationType?: string): string {
    const config = getConfig();
    const tagName = config.webComponentName || 'sg-icon';

    const lines: string[] = [
      `<!-- Web Component (basic) -->`,
      `<${tagName} name="${iconName}"></${tagName}>`,
      ``,
      `<!-- Web Component (variant) -->`,
      `<${tagName} name="${iconName}" variant="custom"></${tagName}>`,
      ``,
      `<!-- Web Component (variant + animation) -->`,
      `<${tagName} name="${iconName}" variant="custom"${animationType && animationType !== 'none' ? ` animation="${animationType}"` : ''}></${tagName}>`,
      ``,
      `<!-- SVG Use (Sprite) -->`,
      `<svg><use href="sprite.svg#${iconName}"></use></svg>`,
      ``,
      `<!-- JavaScript Import -->`,
      `import { ${toVariableName(iconName)} } from './icons.js';`,
      `// Create web component programmatically and set variant/animation`,
      `const el = document.createElement('${tagName}');`,
      `el.setAttribute('name', '${iconName}');`,
      `el.setAttribute('variant', 'custom');`,
      `document.body.appendChild(el);`,
    ];

    if (animationType && animationType !== 'none') {
      lines.splice(lines.length - 1, 0, `el.setAttribute('animation', '${animationType}');`);
    }

    return getSyntaxHighlighter().highlightUsageCode(lines);
  }

  /**
   * Generate HTML body from template with substitutions
   */
  public generateHtmlBody(
    template: string,
    data: {
      name: string;
      displaySvg: string;
      fileSizeStr: string;
      isBuilt?: boolean;
      colorTabContent: string;
      animationTabContent: string;
      codeTabContent: string;
      animationName?: string;
    }
  ): string {
    const hasAnimation = data.animationName && data.animationName !== 'none';
    return (
      template
        .replace(/\$\{name\}/g, data.name)
        .replace(/\$\{displaySvg\}/g, data.displaySvg)
        .replace(/\$\{fileSizeStr\}/g, data.fileSizeStr)
        .replace(
          /\$\{isBuilt \? '<span class="badge badge-built">BUILT<\/span>' : ''\}/g,
          data.isBuilt ? '<span class="badge badge-built">BUILT</span>' : ''
        )
        .replace(
          'id="animBadge" style="display: none;"',
          hasAnimation
            ? 'id="animBadge" style="display: inline-flex;"'
            : 'id="animBadge" style="display: none;"'
        )
        .replace('<span id="animName"></span>', `<span id="animName">${data.animationName}</span>`)
        .replace(/\$\{colorTabContent\}/g, data.colorTabContent)
        .replace(/\$\{animationTabContent\}/g, data.animationTabContent)
        .replace(/\$\{codeTabContent\}/g, data.codeTabContent)
        // i18n translations for editor body
        .replace(/\$\{i18n_editorBadge\}/g, t('webview.editor.editorBadge'))
        .replace(/\$\{i18n_optimizedBadge\}/g, t('webview.editor.optimizedBadge'))
        .replace(/\$\{i18n_renameIcon\}/g, t('webview.editor.renameIcon'))
        .replace(/\$\{i18n_zoomOut\}/g, t('webview.editor.zoomOut'))
        .replace(/\$\{i18n_zoomIn\}/g, t('webview.editor.zoomIn'))
        .replace(/\$\{i18n_resetZoom\}/g, t('webview.editor.resetZoom'))
        .replace(/\$\{i18n_restartAnimation\}/g, t('webview.editor.restartAnimation'))
        .replace(/\$\{i18n_buildIcons\}/g, t('webview.editor.buildIcons'))
        .replace(/\$\{i18n_copySvg\}/g, t('webview.editor.copySvg'))
        .replace(/\$\{i18n_optimizeSvg\}/g, t('webview.editor.optimizeSvg'))
        .replace(/\$\{i18n_applyOnBuild\}/g, t('webview.editor.applyOnBuild'))
        .replace(/\$\{i18n_discardOptimization\}/g, t('webview.editor.discardOptimization'))
        .replace(/\$\{i18n_tabColor\}/g, t('webview.editor.tabColor'))
        .replace(/\$\{i18n_tabAnimation\}/g, t('webview.editor.tabAnimation'))
        .replace(/\$\{i18n_tabCode\}/g, t('webview.editor.tabCode'))
    );
  }

  /**
   * Generate Animation Tab HTML from template
   */
  public generateAnimationTabHtml(
    template: string,
    detectedAnimation: { type: string; settings?: AnimationSettings } | null
  ): string {
    const currentType = detectedAnimation?.type || 'none';
    const settings = detectedAnimation?.settings || {
      duration: 1,
      timing: 'ease',
      iteration: 'infinite',
      delay: 0,
      direction: 'normal',
    };

    const basicButtons = this.generateAnimationButtonsForCategory('basic', currentType);
    const attentionButtons = this.generateAnimationButtonsForCategory('attention', currentType);
    const entranceButtons = this.generateAnimationButtonsForCategory('entrance', currentType);
    const drawButtons = this.generateAnimationButtonsForCategory('draw', currentType);

    return (
      template
        .replace(/\$\{basicAnimationButtons\}/g, basicButtons)
        .replace(/\$\{attentionAnimationButtons\}/g, attentionButtons)
        .replace(/\$\{entranceAnimationButtons\}/g, entranceButtons)
        .replace(/\$\{drawAnimationButtons\}/g, drawButtons)
        .replace(/\$\{duration\}/g, String(settings.duration))
        .replace(/\$\{delay\}/g, String(settings.delay || 0))
        .replace(/\$\{timingLinearSelected\}/g, settings.timing === 'linear' ? 'selected' : '')
        .replace(/\$\{timingEaseSelected\}/g, settings.timing === 'ease' ? 'selected' : '')
        .replace(/\$\{timingEaseInSelected\}/g, settings.timing === 'ease-in' ? 'selected' : '')
        .replace(/\$\{timingEaseOutSelected\}/g, settings.timing === 'ease-out' ? 'selected' : '')
        .replace(
          /\$\{timingEaseInOutSelected\}/g,
          settings.timing === 'ease-in-out' ? 'selected' : ''
        )
        .replace(/\$\{iteration1Selected\}/g, settings.iteration === '1' ? 'selected' : '')
        .replace(/\$\{iteration2Selected\}/g, settings.iteration === '2' ? 'selected' : '')
        .replace(/\$\{iteration3Selected\}/g, settings.iteration === '3' ? 'selected' : '')
        .replace(
          /\$\{iterationInfiniteSelected\}/g,
          settings.iteration === 'infinite' ? 'selected' : ''
        )
        .replace(
          /\$\{directionNormalSelected\}/g,
          settings.direction === 'normal' ? 'selected' : ''
        )
        .replace(
          /\$\{directionReverseSelected\}/g,
          settings.direction === 'reverse' ? 'selected' : ''
        )
        .replace(
          /\$\{directionAlternateSelected\}/g,
          settings.direction === 'alternate' ? 'selected' : ''
        )
        .replace(
          /\$\{directionAltReverseSelected\}/g,
          settings.direction === 'alternate-reverse' ? 'selected' : ''
        )
        .replace(/\$\{copyAnimBtnDisabled\}/g, currentType === 'none' ? 'disabled' : '')
        .replace(/\$\{saveAnimBtnDisabled\}/g, '') // Save button is always enabled (can save 'none' to remove)
        // i18n translations for animation tab
        .replace(/\$\{i18n_animationType\}/g, t('webview.animation.animationType'))
        .replace(/\$\{i18n_categoryBasic\}/g, t('webview.animation.categoryBasic'))
        .replace(/\$\{i18n_categoryAttention\}/g, t('webview.animation.categoryAttention'))
        .replace(/\$\{i18n_categoryEntrance\}/g, t('webview.animation.categoryEntrance'))
        .replace(/\$\{i18n_categoryDraw\}/g, t('webview.animation.categoryDraw'))
        .replace(/\$\{i18n_drawHint\}/g, t('webview.animation.drawHint'))
        .replace(/\$\{i18n_settings\}/g, t('webview.animation.settings'))
        .replace(/\$\{i18n_duration\}/g, t('webview.animation.duration'))
        .replace(/\$\{i18n_delay\}/g, t('webview.animation.delay'))
        .replace(/\$\{i18n_timing\}/g, t('webview.animation.timing'))
        .replace(/\$\{i18n_iteration\}/g, t('webview.animation.iteration'))
        .replace(/\$\{i18n_direction\}/g, t('webview.animation.direction'))
        .replace(/\$\{i18n_timingLinear\}/g, t('webview.animation.timingLinear'))
        .replace(/\$\{i18n_timingEase\}/g, t('webview.animation.timingEase'))
        .replace(/\$\{i18n_timingEaseIn\}/g, t('webview.animation.timingEaseIn'))
        .replace(/\$\{i18n_timingEaseOut\}/g, t('webview.animation.timingEaseOut'))
        .replace(/\$\{i18n_timingEaseInOut\}/g, t('webview.animation.timingEaseInOut'))
        .replace(/\$\{i18n_iterationOnce\}/g, t('webview.animation.iterationOnce'))
        .replace(/\$\{i18n_iterationTwice\}/g, t('webview.animation.iterationTwice'))
        .replace(/\$\{i18n_iteration3Times\}/g, t('webview.animation.iteration3Times'))
        .replace(/\$\{i18n_iterationInfinite\}/g, t('webview.animation.iterationInfinite'))
        .replace(/\$\{i18n_directionNormal\}/g, t('webview.animation.directionNormal'))
        .replace(/\$\{i18n_directionReverse\}/g, t('webview.animation.directionReverse'))
        .replace(/\$\{i18n_directionAlternate\}/g, t('webview.animation.directionAlternate'))
        .replace(/\$\{i18n_directionAltReverse\}/g, t('webview.animation.directionAltReverse'))
        .replace(/\$\{i18n_export\}/g, t('webview.animation.export'))
        .replace(/\$\{i18n_saveAnimation\}/g, t('webview.animation.saveAnimation'))
        .replace(/\$\{i18n_saveAnimationTooltip\}/g, t('webview.animation.saveAnimationTooltip'))
        .replace(/\$\{i18n_copyWithAnimation\}/g, t('webview.animation.copyWithAnimation'))
        .replace(/\$\{i18n_exportHint\}/g, t('webview.animation.exportHint'))
    );
  }

  /**
   * Generate Code Tab HTML from template
   */
  public generateCodeTabHtml(
    template: string,
    name: string,
    svg: string,
    detectedAnimation: { type: string; settings?: AnimationSettings } | null
  ): string {
    const animType = detectedAnimation?.type || 'none';
    const hasAnimation = animType !== 'none';

    return (
      template
        .replace(/\$\{svgCodeHighlighted\}/g, getSyntaxHighlighter().highlightSvg(svg))
        .replace(/\$\{animationSectionStyle\}/g, hasAnimation ? '' : 'display: none;')
        .replace(/\$\{animationType\}/g, animType)
        .replace(
          /\$\{animationCodeHtml\}/g,
          this.generateAnimationCodeHtml(animType, detectedAnimation?.settings)
        )
        .replace(
          /\$\{buildFormatBadge\}/g,
          getConfig().buildFormat === 'sprite.svg' ? 'Sprite' : 'WebComponent'
        )
        .replace(/\$\{usageCodeHtml\}/g, this.generateUsageCodeHtml(name, animType))
        // i18n translations for code tab
        .replace(/\$\{i18n_svgSource\}/g, t('webview.code.svgSource'))
        .replace(/\$\{i18n_animationCss\}/g, t('webview.code.animationCss'))
        .replace(/\$\{i18n_usageExample\}/g, t('webview.code.usageExample'))
        .replace(/\$\{i18n_copy\}/g, t('webview.code.copy'))
        .replace(/\$\{i18n_copySvg\}/g, t('webview.code.copySvg'))
        .replace(/\$\{i18n_copyAnimation\}/g, t('webview.code.copyAnimation'))
        .replace(/\$\{i18n_copyUsage\}/g, t('webview.code.copyUsage'))
    );
  }

  /**
   * Generate disabled colors section HTML for SVGs with too many colors
   */
  public generateDisabledColorsHtml(totalColorCount: number): string {
    return `
      <div class="section disabled-section">
        <div class="section-title">
          <span class="codicon codicon-paintcan"></span> Colors
        </div>
        <div class="colors-warning">
          <span class="codicon codicon-warning"></span>
          This SVG has ${totalColorCount} unique colors. Color editing is disabled for rasterized SVGs.
        </div>
      </div>
      <div class="section disabled-section">
        <div class="section-title">
          <span class="codicon codicon-symbol-color"></span> Variants
        </div>
        <div class="Variants-disabled-message">
          <span class="codicon codicon-info"></span> Variants disabled for SVGs with too many colors
        </div>
      </div>
    `;
  }

  /**
   * Generate color swatches HTML
   */
  public generateColorSwatchesHtml(
    svgColors: string[],
    colorService: { toHexColor: (color: string) => string }
  ): string {
    return svgColors
      .map(
        (color, index) => `
      <div class="color-item">
        <div class="color-swatch" style="background-color: ${color}">
          <input type="color" value="${colorService.toHexColor(color)}"
            onchange="changeColor(${index}, this.value)"
            oninput="previewColor(${index}, this.value)" />
        </div>
        <span class="color-label">${color}</span>
      </div>
    `
      )
      .join('');
  }

  /**
   * Generate currentColor swatch HTML
   */
  public generateCurrentColorHtml(hasCurrentColor: boolean): string {
    if (!hasCurrentColor) return '';
    return `
      <div class="current-color-item">
        <div class="current-color-swatch" title="currentColor - inherits from CSS">
          <input type="color" value="#000000"
            onchange="replaceCurrentColor(this.value)" />
          <span class="current-color-icon codicon codicon-paintcan"></span>
        </div>
        <span class="current-color-label">currentColor</span>
      </div>
    `;
  }
}

/**
 * Get the singleton instance
 */
export function getIconEditorTemplateService(): IconEditorTemplateService {
  return IconEditorTemplateService.getInstance();
}
