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
  if (ctx.buildFormat !== 'icons.ts') return '';

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
      <div class="preview-summary-item"><span class="preview-summary-label">${tr.previewFormat}</span><span class="preview-summary-value">${ctx.buildFormat === 'icons.ts' ? tr.jsModuleTitle : tr.spriteTitle}</span></div>
      <div class="preview-summary-item" style="${ctx.buildFormat === 'icons.ts' ? '' : 'display:none'}"><span class="preview-summary-label">${tr.previewTag}</span><span class="preview-summary-value">&lt;${ctx.webComponentName}&gt;</span></div>
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
