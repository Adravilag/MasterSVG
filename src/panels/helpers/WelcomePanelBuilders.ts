/**
 * WelcomePanelBuilders - UI component builders for WelcomePanel
 *
 * Builds HTML sections for the wizard interface.
 */

import { scopeSvgIds } from '../../utils/svgIdScoper';
import { WebviewContext } from './WelcomePanelTypes';

/**
 * Builds Step 4 (Component Name) section HTML
 */
export function buildStep4Section(ctx: WebviewContext, tr: Record<string, string>): string {
  if (ctx.buildFormat !== 'icons.js') return '';

  return `
      <div class="component-name-section" style="margin-top: 20px; border-top: 1px solid var(--vscode-widget-border); padding-top: 15px;">
        <div class="step-title" style="font-size: 13px; margin-bottom: 8px; font-weight: 600;">${tr.step4Title}</div>
        <p class="step-description">${tr.step4Desc}</p>
        <div class="input-group">
          <input type="text" id="webComponentName" value="${ctx.webComponentName}" placeholder="${tr.step4Placeholder}" onkeypress="handleTagKeypress(event)" />
          <button class="btn-secondary" onclick="applyWebComponentName()">${tr.step1Apply}</button>
        </div>
      </div>`;
}

/**
 * Builds the preview icons gallery HTML
 */
export function buildPreviewGallery(): string {
  const suffix = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const svgHome = scopeSvgIds(
    `<svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
    suffix + '_home'
  );

  const svgHeart = scopeSvgIds(
    `<svg viewBox="0 0 24 24" style="fill: #e25555;"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
    suffix + '_heart'
  );

  const svgSettings = scopeSvgIds(
    `<svg viewBox="0 0 24 24"><g><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/><animateTransform attributeType="XML" attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></g></svg>`,
    suffix + '_settings'
  );

  const svgCheck = scopeSvgIds(
    `<svg viewBox="0 0 24 24" style="fill: #2b8a3e;"><g><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/><animateTransform attributeType="XML" attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"/></g></svg>`,
    suffix + '_check'
  );

  return `<div class="preview-icons-gallery">
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgHome}</div><span>home</span></div>
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgHeart}</div><span>heart</span></div>
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgSettings}</div><span>settings</span></div>
      <div class="preview-icon-item"><div class="preview-icon-box small">${svgCheck}</div><span>check</span></div>
    </div>`;
}

/**
 * Builds the preview summary section HTML
 */
export function buildPreviewSummary(ctx: WebviewContext, tr: Record<string, string>): string {
  if (!ctx.isFullyConfigured) return '';

  return `<div class="preview-summary">
      <div class="preview-summary-item"><span class="preview-summary-label">${tr.previewOutput}</span><span class="preview-summary-value">${ctx.outputDir}</span></div>
      <div class="preview-summary-item"><span class="preview-summary-label">${tr.previewFormat}</span><span class="preview-summary-value">${ctx.buildFormat === 'icons.js' ? tr.jsModuleTitle : ctx.buildFormat === 'css' ? (tr.cssIconsTitle || 'CSS Icons') : tr.spriteTitle}</span></div>
      <div class="preview-summary-item" style="${ctx.buildFormat === 'icons.js' ? '' : 'display:none'}"><span class="preview-summary-label">${tr.previewTag}</span><span class="preview-summary-value">&lt;${ctx.webComponentName}&gt;</span></div>
    </div>`;
}

/**
 * Builds the finish button HTML
 */
export function buildFinishButton(isFullyConfigured: boolean, tr: Record<string, string>): string {
  return isFullyConfigured
    ? `<button class="btn-primary btn-finish" onclick="finishSetup()"><svg class="svg-icon" viewBox="0 0 24 24" style="fill: white; width: 20px; height: 20px;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>${tr.getStarted}</button>`
    : `<button class="btn-secondary" disabled>${tr.completeStep1}</button>`;
}

/**
 * Builds the setup guide section HTML for the selected framework/format
 */
export function buildSetupGuide(ctx: WebviewContext, tr: Record<string, string>): string {
  if (!ctx.isFullyConfigured) return '';

  const guideTitle = tr.setupGuideTitle || 'Setup Guide';

  let steps: SetupStep[];
  let badgeLabel: string;

  if (ctx.buildFormat === 'sprite.svg') {
    steps = getSpriteSetupSteps(ctx, tr);
    badgeLabel = 'SVG Sprite';
  } else if (ctx.buildFormat === 'css') {
    steps = getCssSetupSteps(ctx, tr);
    badgeLabel = 'CSS';
  } else {
    steps = getFrameworkSetupSteps(ctx, tr);
    badgeLabel = ctx.framework.charAt(0).toUpperCase() + ctx.framework.slice(1);
  }

  const stepsHtml = steps
    .map((step, i) => {
      const descHtml = step.desc ? `<div class="setup-step-desc">${step.desc}</div>` : '';
      const iconHtml = step.icon ? `<svg viewBox="0 0 24 24">${step.icon}</svg>` : '';
      return `<div class="setup-step">
        <div class="setup-step-indicator">
          <div class="setup-step-number">${i + 1}</div>
          <div class="setup-step-line"></div>
        </div>
        <div class="setup-step-content">
          <div class="setup-step-title">${iconHtml}${step.title}</div>
          ${descHtml}
          <code class="setup-step-code">${step.code}</code>
        </div>
      </div>`;
    })
    .join('\n');

  const tipText = tr.setupGuideTip || 'You can also use <kbd>Ctrl+Shift+P</kbd> and type <kbd>MasterSVG</kbd> to see all available commands.';

  return `<div class="setup-guide">
    <div class="setup-guide-header">
      <svg viewBox="0 0 24 24"><path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2z"/></svg>
      <span>${guideTitle}</span>
      <span class="setup-framework-badge">${badgeLabel}</span>
    </div>
    <div class="setup-steps">
      ${stepsHtml}
    </div>
    <div class="setup-guide-tip">
      <svg viewBox="0 0 24 24"><path d="M9 21c0 .5.4 1 1 1h4c.6 0 1-.5 1-1v-1H9v1zm3-19C8.1 2 5 5.1 5 9c0 2.4 1.2 4.5 3 5.7V17c0 .5.4 1 1 1h6c.6 0 1-.5 1-1v-2.3c1.8-1.3 3-3.4 3-5.7 0-3.9-3.1-7-7-7z"/></svg>
      <span>${tipText}</span>
    </div>
  </div>`;
}

/** Setup step with optional description and icon */
interface SetupStep {
  title: string;
  code: string;
  desc?: string;
  icon?: string;
}

/** SVG path constants for step icons */
const ICON_TERMINAL = '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v12zm-2-1h-6v-2h6v2zM7.5 17l-1.41-1.41L8.67 13l-2.59-2.59L7.5 9l4 4-4 4z"/>';
const ICON_CODE = '<path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>';
const ICON_ROCKET = '<path d="M12 2.5s-5 6-5 11.5c0 2.8 2.2 5 5 5s5-2.2 5-5c0-5.5-5-11.5-5-11.5zm0 14.5c-1.7 0-3-1.3-3-3 0-2.6 1.6-5.6 3-7.8 1.4 2.2 3 5.2 3 7.8 0 1.7-1.3 3-3 3z"/>';
const ICON_LINK = '<path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>';
const ICON_PALETTE = '<path d="M12 2C6.49 2 2 6.49 2 12s4.49 10 10 10c1.38 0 2.5-1.12 2.5-2.5 0-.61-.23-1.2-.64-1.67-.08-.1-.13-.21-.13-.33 0-.28.22-.5.5-.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 8 6.5 8 8 8.67 8 9.5 7.33 11 6.5 11zm3-4C8.67 7 8 6.33 8 5.5S8.67 4 9.5 4s1.5.67 1.5 1.5S10.33 7 9.5 7zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 4 14.5 4s1.5.67 1.5 1.5S15.33 7 14.5 7zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 8 17.5 8s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>';

/** Syntax helper — wraps text in a span class for code highlighting */
function hl(cls: string, text: string): string { return `<span class="${cls}">${text}</span>`; }

/** Setup steps for Sprite SVG format */
function getSpriteSetupSteps(ctx: WebviewContext, tr: Record<string, string>): SetupStep[] {
  const dir = ctx.outputDirDisplay || ctx.outputDir;
  const buildCmd = tr.setupBuildCmd || 'MasterSVG: Build Icons';
  return [
    {
      title: tr.setupStepBuild || 'Build icons from Command Palette',
      desc: tr.setupStepBuildDesc || 'This generates the sprite and type definitions in your output folder.',
      code: `${hl('fn', 'Ctrl+Shift+P')} → ${hl('val', buildCmd)}`,
      icon: ICON_TERMINAL,
    },
    {
      title: tr.setupStepSpriteRef || 'Reference the sprite in your HTML',
      desc: tr.setupStepSpriteRefDesc || 'Use the &lt;use&gt; element with the sprite path and icon ID.',
      code: `${hl('tag', '&lt;svg')}&gt;${hl('tag', '&lt;use')} ${hl('attr', 'href')}=${hl('val', `"${dir}/sprite.svg#home"`)} ${hl('tag', '/&gt;')}${hl('tag', '&lt;/svg&gt;')}`,
      icon: ICON_LINK,
    },
    {
      title: tr.setupStepStyle || 'Style with CSS as needed',
      desc: tr.setupStepStyleDesc || 'Icons inherit currentColor by default. Set width/height as needed.',
      code: `${hl('tag', 'svg')} { ${hl('attr', 'width')}: ${hl('val', '24px')}; ${hl('attr', 'height')}: ${hl('val', '24px')}; ${hl('attr', 'fill')}: ${hl('kw', 'currentColor')}; }`,
      icon: ICON_PALETTE,
    },
  ];
}

/** Setup steps for CSS Icons format */
function getCssSetupSteps(ctx: WebviewContext, tr: Record<string, string>): SetupStep[] {
  const dir = ctx.outputDirDisplay || ctx.outputDir;
  const buildCmd = tr.setupBuildCmd || 'MasterSVG: Build Icons';
  return [
    {
      title: tr.setupStepBuild || 'Build icons from Command Palette',
      desc: tr.setupStepBuildDesc || 'This generates the CSS stylesheet and type definitions.',
      code: `${hl('fn', 'Ctrl+Shift+P')} → ${hl('val', buildCmd)}`,
      icon: ICON_TERMINAL,
    },
    {
      title: tr.setupStepCssLink || 'Link the stylesheet',
      desc: tr.setupStepCssLinkDesc || 'Add the generated stylesheet to your HTML head.',
      code: `${hl('tag', '&lt;link')} ${hl('attr', 'rel')}=${hl('val', '"stylesheet"')} ${hl('attr', 'href')}=${hl('val', `"${dir}/icons.css"`)}${hl('tag', '&gt;')}`,
      icon: ICON_LINK,
    },
    {
      title: tr.setupStepCssUse || 'Use CSS classes',
      desc: tr.setupStepCssUseDesc || 'Just add the icon class. Colors inherit via currentColor.',
      code: `${hl('tag', '&lt;span')} ${hl('attr', 'class')}=${hl('val', '"icon icon-home"')}${hl('tag', '&gt;&lt;/span&gt;')}`,
      icon: ICON_ROCKET,
    },
  ];
}

/** Setup steps for JS Module format per framework */
function getFrameworkSetupSteps(ctx: WebviewContext, tr: Record<string, string>): SetupStep[] {
  const dir = ctx.outputDirDisplay || ctx.outputDir;
  const comp = ctx.webComponentDisplay || 'Icon';
  const buildCmd = tr.setupBuildCmd || 'MasterSVG: Build Icons';

  const buildStep: SetupStep = {
    title: tr.setupStepBuild || 'Build icons from Command Palette',
    desc: tr.setupStepBuildDesc || 'This generates the component, icon data, and type definitions.',
    code: `${hl('fn', 'Ctrl+Shift+P')} → ${hl('val', buildCmd)}`,
    icon: ICON_TERMINAL,
  };

  switch (ctx.framework) {
    case 'react':
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import the component',
          desc: 'Import the typed React component with full autocomplete support.',
          code: `${hl('kw', 'import')} { ${hl('fn', comp)} } ${hl('kw', 'from')} ${hl('val', `'${dir}/${comp}'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your JSX',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${comp}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '{24}')} ${hl('tag', '/&gt;')}`,
          icon: ICON_ROCKET,
        },
      ];
    case 'vue':
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import the component',
          desc: 'Import in your &lt;script setup&gt; block for SFC auto-registration.',
          code: `${hl('kw', 'import')} ${hl('fn', comp)} ${hl('kw', 'from')} ${hl('val', `'${dir}/${comp}.vue'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your template',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', ':size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${comp}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', ':size')}=${hl('val', '"24"')} ${hl('tag', '/&gt;')}`,
          icon: ICON_ROCKET,
        },
      ];
    case 'svelte':
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import the component',
          desc: 'Import in your &lt;script&gt; block.',
          code: `${hl('kw', 'import')} ${hl('fn', comp)} ${hl('kw', 'from')} ${hl('val', `'${dir}/${comp}.svelte'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your markup',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${comp}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '{24}')} ${hl('tag', '/&gt;')}`,
          icon: ICON_ROCKET,
        },
      ];
    case 'angular': {
      const sel = comp || 'app-icon';
      const cls = sel.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Component';
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import in your component',
          desc: `Add ${hl('fn', cls)} to your component's imports array.`,
          code: `${hl('kw', 'import')} { ${hl('fn', cls)} } ${hl('kw', 'from')} ${hl('val', `'${dir}/${cls}'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your template',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', '[size]')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${sel}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', '[size]')}=${hl('val', '"24"')}${hl('tag', `&gt;&lt;/${sel}&gt;`)}`,
          icon: ICON_ROCKET,
        },
      ];
    }
    case 'astro':
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import the component',
          desc: 'Import in your frontmatter (--- block).',
          code: `${hl('kw', 'import')} ${hl('fn', comp)} ${hl('kw', 'from')} ${hl('val', `'${dir}/${comp}.astro'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your .astro file',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${comp}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '{24}')} ${hl('tag', '/&gt;')}`,
          icon: ICON_ROCKET,
        },
      ];
    case 'solid':
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import the component',
          desc: 'Import the reactive Solid component.',
          code: `${hl('kw', 'import')} { ${hl('fn', comp)} } ${hl('kw', 'from')} ${hl('val', `'${dir}/${comp}'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your JSX',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${comp}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '{24}')} ${hl('tag', '/&gt;')}`,
          icon: ICON_ROCKET,
        },
      ];
    case 'qwik':
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import the component',
          desc: 'Import inside your component$ function.',
          code: `${hl('kw', 'import')} { ${hl('fn', comp)} } ${hl('kw', 'from')} ${hl('val', `'${dir}/${comp}'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use in your component$',
          desc: `Props: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${comp}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '{24}')} ${hl('tag', '/&gt;')}`,
          icon: ICON_ROCKET,
        },
      ];
    case 'lit': {
      const tagName = comp || 'svg-icon';
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Import as side-effect',
          desc: 'The import registers the custom element automatically.',
          code: `${hl('kw', 'import')} ${hl('val', `'${dir}/Icon'`)};`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use the custom element',
          desc: `Attributes: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${tagName}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '"24"')}${hl('tag', `&gt;&lt;/${tagName}&gt;`)}`,
          icon: ICON_ROCKET,
        },
      ];
    }
    default: {
      const tagName = comp || 'svg-icon';
      return [
        buildStep,
        {
          title: tr.setupStepImport || 'Include the scripts',
          desc: 'Load the icon data and web component registrar.',
          code: `${hl('tag', '&lt;script')} ${hl('attr', 'src')}=${hl('val', `"${dir}/icons.js"`)}${hl('tag', '&gt;&lt;/script&gt;')}`,
          icon: ICON_CODE,
        },
        {
          title: tr.setupStepUse || 'Use the custom element',
          desc: `Attributes: ${hl('attr', 'name')} (required), ${hl('attr', 'size')}, ${hl('attr', 'color')}, ${hl('attr', 'variant')}, ${hl('attr', 'animation')}`,
          code: `${hl('tag', `&lt;${tagName}`)} ${hl('attr', 'name')}=${hl('val', '"home"')} ${hl('attr', 'size')}=${hl('val', '"24"')}${hl('tag', `&gt;&lt;/${tagName}&gt;`)}`,
          icon: ICON_ROCKET,
        },
      ];
    }
  }
}
