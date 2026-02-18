/**
 * WelcomePanelTemplates - Template replacement functions for WelcomePanel
 *
 * Handles all HTML template string replacements for the wizard steps.
 */

import { t } from '../../i18n';
import { WebviewContext, TemplateReplacementOptions, PreviewReplacementOptions } from './WelcomePanelTypes';

/**
 * Applies all template replacements to HTML content
 */
export function applyTemplateReplacements(opts: TemplateReplacementOptions): string {
  const { html, ctx, tr, languageOptions, step4Section, previewCode, previewWindowTitle, previewGallery, previewSummary, setupGuide, finishButton, iconUri } = opts;

  let result = applyHeaderReplacements(html, tr, languageOptions, iconUri);
  result = applyStep0Replacements(result, ctx, tr);
  result = applyStep1Replacements(result, ctx, tr);
  result = applyStep2Replacements(result, ctx, tr);
  result = applyStep3Replacements(result, ctx, tr);
  result = applyFrameworkReplacements(result, ctx.framework);
  result = applyAdvancedReplacements(result, ctx, tr, step4Section);
  result = applyPreviewReplacements({
    html: result,
    ctx,
    tr,
    previewCode,
    previewWindowTitle,
    previewGallery,
    previewSummary,
    setupGuide,
    finishButton,
  });

  return result;
}

/**
 * Applies header section replacements
 */
function applyHeaderReplacements(html: string, tr: Record<string, string>, languageOptions: string, iconUri?: string): string {
  return html
    .replace(/\$\{headerIcons\}/g, tr.headerIcons)
    .replace(/\$\{headerColors\}/g, tr.headerColors)
    .replace(/\$\{headerAnimations\}/g, tr.headerAnimations)
    .replace(/\$\{headerSvgo\}/g, tr.headerSvgo)
    .replace(/\$\{languageOptions\}/g, languageOptions)
    .replace(/\$\{languageLabel\}/g, tr.languageLabel)
    .replace(/\$\{appTitle\}/g, tr.appTitle)
    .replace(/\$\{iconUri\}/g, iconUri || '');
}

/**
 * Applies Step 0 (Frontend Root) replacements
 */
function applyStep0Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
  const frontendRootOptions = buildFrontendRootOptions(ctx);
  const showStep0 = ctx.suggestedFrontendRoots.length > 1;
  const step0Classes = [
    ctx.isFrontendConfigured ? 'completed-step' : '',
    !showStep0 ? 'hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return html
    .replace(/\$\{step0Class\}/g, step0Classes)
    .replace(/\$\{step0NumberClass\}/g, ctx.isFrontendConfigured ? 'completed' : '')
    .replace(/\$\{step0Title\}/g, tr.step0Title || 'Directorio Frontend')
    .replace(
      /\$\{step0Summary\}/g,
      ctx.frontendRoot ? `<span class="step-summary">${ctx.frontendRoot || '.'}/</span>` : ''
    )
    .replace(
      /\$\{step0Desc\}/g,
      tr.step0Desc || 'Selecciona el directorio del frontend si tu workspace tiene múltiples proyectos.'
    )
    .replace(/\$\{frontendRootOptions\}/g, frontendRootOptions);
}

/**
 * Builds frontend root options HTML
 */
function buildFrontendRootOptions(ctx: WebviewContext): string {
  const folderIcon =
    '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
  const rootLabel = t('welcome.rootFolder') || '. (root)';

  return ctx.suggestedFrontendRoots
    .map(dir => {
      const displayName = dir === '.' ? rootLabel : dir;
      const selected = ctx.frontendRoot === dir ? 'selected' : '';
      return `<div class="option ${selected}" onclick="setFrontendRoot('${dir}')">
              <span class="option-icon">${folderIcon}</span>
              <span class="option-label">${displayName}</span>
            </div>`;
    })
    .join('\n            ');
}

/**
 * Applies Step 1 (Source Directory) replacements
 */
export function applyStep1Replacements(
  html: string,
  ctx: WebviewContext,
  tr: Record<string, string>,
  createMsignore = true
): string {
  const sourceDirectoryOptions = buildSourceDirectoryOptions(ctx);
  const msignoreChecked = createMsignore ? 'checked' : '';

  return html
    .replace(/\$\{step1SourceClass\}/g, ctx.isSourceConfigured ? 'completed-step' : '')
    .replace(/\$\{step1SourceNumberClass\}/g, ctx.isSourceConfigured ? 'completed' : '')
    .replace(/\$\{step1SourceTitle\}/g, tr.step1SourceTitle)
    .replace(
      /\$\{step1SourceSummary\}/g,
      ctx.isSourceConfigured ? `<span class="step-summary">${ctx.sourceDir}</span>` : ''
    )
    .replace(/\$\{step1SourceDesc\}/g, tr.step1SourceDesc)
    .replace(/\$\{step1SourcePlaceholder\}/g, tr.step1SourcePlaceholder)
    .replace(/\$\{sourceDirectoryOptions\}/g, sourceDirectoryOptions)
    .replace(/\$\{browse\}/g, tr.browse)
    .replace(/\$\{step1Apply\}/g, tr.step1Apply)
    .replace(/\$\{msignoreLabel\}/g, tr.msignoreLabel || 'Crear archivo .msignore')
    .replace(
      /\$\{msignoreHint\}/g,
      tr.msignoreHint || 'Excluye node_modules, dist, build y otros directorios comunes del escaneo'
    )
    .replace(/\$\{msignoreChecked\}/g, msignoreChecked);
}

/**
 * Builds source directory options HTML
 */
function buildSourceDirectoryOptions(ctx: WebviewContext): string {
  const folderIcon =
    '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
  const rootLabel = t('welcome.rootFolder') || '. (raíz)';
  const selected = ctx.sourceDir === '.' ? 'selected' : '';

  return `<div class="option ${selected}" onclick="setSourceDirectory('.')">
              <span class="option-icon">${folderIcon}</span>
              <span class="option-label">${rootLabel}</span>
            </div>`;
}

/**
 * Applies Step 2 (Output Directory) replacements
 */
function applyStep2Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
  const outputDirectoryOptions = buildOutputDirectoryOptions(ctx);

  return html
    .replace(/\$\{step2Class\}/g, `${ctx.isOutputConfigured ? 'completed-step' : ''}`)
    .replace(/\$\{step2NumberClass\}/g, ctx.isOutputConfigured ? 'completed' : '')
    .replace(/\$\{step2Disabled\}/g, '')
    .replace(/\$\{step2Title\}/g, tr.step2Title)
    .replace(
      /\$\{step2Summary\}/g,
      ctx.isOutputConfigured ? `<span class="step-summary">${ctx.outputDir}</span>` : ''
    )
    .replace(/\$\{step2Desc\}/g, tr.step2Desc)
    .replace(/\$\{step2Placeholder\}/g, tr.step2Placeholder)
    .replace(/\$\{outputDir\}/g, ctx.outputDir)
    .replace(/\$\{outputDirectoryOptions\}/g, outputDirectoryOptions);
}

/**
 * Builds output directory options HTML
 */
function buildOutputDirectoryOptions(ctx: WebviewContext): string {
  const folderIcon =
    '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';

  return ctx.suggestedOutputDirs
    .map(dir => {
      const selected = ctx.outputDir === dir ? 'selected' : '';
      return `<div class="option ${selected}" onclick="setDirectory('${dir}')">
              <span class="option-icon">${folderIcon}</span>
              <span class="option-label">${dir}</span>
            </div>`;
    })
    .join('\n            ');
}

/**
 * Applies Step 3 (Build Format) replacements
 */
function applyStep3Replacements(html: string, ctx: WebviewContext, tr: Record<string, string>): string {
  const jsModuleSelectedValue = ctx.buildFormat === 'icons.js' ? 'selected' : '';
  const transformSelectedValue = ctx.buildFormat === 'transform' ? 'selected' : '';
  const spriteSvgSelectedValue = ctx.buildFormat === 'sprite.svg' ? 'selected' : '';
  const cssSelectedValue = ctx.buildFormat === 'css' ? 'selected' : '';

  // Consider the step configured only when both a build format and a framework are selected
  const isFormatAndFrameworkSelected = !!ctx.framework && !!ctx.buildFormat;

  return html
    .replace(/\$\{step3Class\}/g, `${isFormatAndFrameworkSelected ? 'completed-step' : ''}`)
    .replace(/\$\{step3NumberClass\}/g, isFormatAndFrameworkSelected ? 'completed' : '')
    .replace(/\$\{step3Title\}/g, tr.step3Title)
    .replace(
      /\$\{formatSummary\}/g,
      ctx.buildFormat === 'icons.js'
        ? tr.jsModuleTitle
        : ctx.buildFormat === 'sprite.svg'
          ? tr.spriteTitle
          : ctx.buildFormat === 'css'
            ? (tr.cssIconsTitle || 'CSS Icons')
            : tr.selectFormat || 'Seleccionar...'
    )
    .replace(/\$\{step3Desc\}/g, tr.step3Desc)
    .replace(/\$\{step3Help\}/g, tr.step3Help)
    .replace(/\$\{jsModuleTitle\}/g, tr.jsModuleTitle)
    .replace(/\$\{helpJsModule\}/g, tr.helpJsModule)
    .replace(/\$\{spriteTitle\}/g, tr.spriteTitle)
    .replace(/\$\{helpSprite\}/g, tr.helpSprite)
    .replace(/\$\{helpTip\}/g, tr.helpTip)
    .replace(/\$\{jsModuleSelected\}/g, jsModuleSelectedValue)
    .replace(/\$\{transformSelected\}/g, transformSelectedValue)
    .replace(/\$\{recommended\}/g, tr.recommended)
    .replace(/\$\{jsModuleDesc\}/g, tr.jsModuleDesc)
    .replace(/\$\{jsModulePro1\}/g, tr.jsModulePro1)
    .replace(/\$\{jsModulePro2\}/g, tr.jsModulePro2)
    .replace(/\$\{transformTitle\}/g, tr.transformTitle || tr.jsModuleTitle)
      .replace(/\$\{separateOutputHidden\}/g, ctx.buildFormat === 'icons.js' ? '' : 'style="display:none"')
      .replace(/\$\{codeIntegrationChecked\}/g, ctx.codeIntegrationEnabled ? 'checked' : '')
      .replace(/\$\{codeIntegrationDisabled\}/g, '')
      .replace(/\$\{codeIntegrationLabel\}/g, tr.codeIntegrationLabel || '')
      .replace(/\$\{codeIntegrationHint\}/g, tr.codeIntegrationHint || '')
      .replace(/\$\{codeIntegrationBadge\}/g, ctx.codeIntegrationEnabled && ctx.buildFormat === 'icons.js' ? '<span class="tag-pro">' + (tr.codeIntegrationBadge || '') + '</span>' : '')
      // Transform card removed from template; transform badge placeholder no longer used
    .replace(/\$\{transformPro1\}/g, tr.transformPro1 || tr.jsModulePro1)
    .replace(/\$\{separateOutputHidden\}/g, ctx.buildFormat === 'icons.js' ? '' : 'style="display:none"')
    .replace(/\$\{spriteSvgSelected\}/g, spriteSvgSelectedValue)
    .replace(/\$\{spriteSelected\}/g, spriteSvgSelectedValue)
    .replace(/\$\{spriteDesc\}/g, tr.spriteDesc)
    .replace(/\$\{spritePro1\}/g, tr.spritePro1)
    .replace(/\$\{spritePro2\}/g, tr.spritePro2)
    .replace(/\$\{cssSelected\}/g, cssSelectedValue)
    .replace(/\$\{cssIconsTitle\}/g, tr.cssIconsTitle || 'CSS Icons')
    .replace(/\$\{cssIconsDesc\}/g, tr.cssIconsDesc || '')
    .replace(/\$\{cssIconsPro1\}/g, tr.cssIconsPro1 || 'Zero JS')
    .replace(/\$\{cssIconsPro2\}/g, tr.cssIconsPro2 || 'currentColor')
    .replace(/\$\{helpCssIcons\}/g, tr.helpCssIcons || '')
    .replace(/\$\{frameworkLabel\}/g, tr.frameworkLabel);
}

/**
 * Applies framework selection replacements
 */
function applyFrameworkReplacements(html: string, framework: string): string {
  return html
    .replace(/\$\{frameworkHtmlSelected\}/g, framework === 'html' ? 'selected' : '')
    .replace(/\$\{frameworkReactSelected\}/g, framework === 'react' ? 'selected' : '')
    .replace(/\$\{frameworkVueSelected\}/g, framework === 'vue' ? 'selected' : '')
    .replace(/\$\{frameworkAngularSelected\}/g, framework === 'angular' ? 'selected' : '')
    .replace(/\$\{frameworkSvelteSelected\}/g, framework === 'svelte' ? 'selected' : '')
    .replace(/\$\{frameworkAstroSelected\}/g, framework === 'astro' ? 'selected' : '')
    .replace(/\$\{frameworkLitSelected\}/g, framework === 'lit' ? 'selected' : '');
}

/**
 * Applies build options replacements (moved from advanced panel into Step 1)
 */
function applyAdvancedReplacements(
  html: string,
  ctx: WebviewContext,
  tr: Record<string, string>,
  step4Section: string
): string {
  return html
    .replace(/\$\{step4Section\}/g, step4Section)
    .replace(/\$\{buildOptionsTitle\}/g, tr.buildOptionsTitle)
    .replace(/\$\{buildOptionsBeta\}/g, tr.buildOptionsBeta || 'Beta')
    .replace(/\$\{separateOutputLabel\}/g, tr.separateOutputLabel)
    .replace(/\$\{separateOutputHint\}/g, tr.separateOutputHint)
   .replace(/\$\{separateOutputChecked\}/g, ctx.separateOutputStructure ? 'checked' : '')
   .replace(/\$\{separateOutputDisabled\}/g, ctx.buildFormat === 'icons.js' ? '' : `disabled title="${tr.separateOutputDisabledHint || 'Applies only to JS/TS modules'}"`)
    .replace(/\$\{defaultIconSizeLabel\}/g, tr.defaultIconSizeLabel)
    .replace(/\$\{previewBackgroundLabel\}/g, tr.previewBackgroundLabel)
    .replace(/\$\{defaultIconSize\}/g, String(ctx.defaultIconSize))
    .replace(/\$\{bgTransparent\}/g, ctx.previewBackground === 'transparent' ? 'selected' : '')
    .replace(/\$\{bgLight\}/g, ctx.previewBackground === 'light' ? 'selected' : '')
    .replace(/\$\{bgDark\}/g, ctx.previewBackground === 'dark' ? 'selected' : '')
    .replace(/\$\{bgCheckered\}/g, ctx.previewBackground === 'checkered' ? 'selected' : '');
}

/**
 * Applies preview section replacements
 */
function applyPreviewReplacements(opts: PreviewReplacementOptions): string {
  const { html, ctx, tr, previewCode, previewWindowTitle, previewGallery, previewSummary, setupGuide, finishButton } = opts;

  return html
    .replace(/\$\{previewTitle\}/g, tr.previewTitle)
    .replace(
      /\$\{previewFileName\}/g,
      ctx.buildFormat === 'icons.js'
        ? 'icons.js'
        : ctx.buildFormat === 'sprite.svg'
          ? 'sprite.svg'
          : ctx.buildFormat === 'css'
            ? 'icons.css'
            : '...'
    )
    .replace(/\$\{previewWindowTitle\}/g, previewWindowTitle)
    .replace(/\$\{previewCode\}/g, previewCode)
    .replace(/\$\{previewSummary\}/g, previewSummary)
    .replace(/\$\{previewResultLabel\}/g, tr.previewResultLabel)
    .replace(/\$\{previewGallery\}/g, previewGallery)
    .replace(/\$\{workflowSource\}/g, tr.workflowSource)
    .replace(/\$\{workflowBuild\}/g, tr.workflowBuild)
    .replace(/\$\{workflowOutput\}/g, tr.workflowOutput)
    .replace(/\$\{sourceDirDisplay\}/g, ctx.sourceDir || 'src/icons/')
    .replace(/\$\{comingSoon\}/g, tr.comingSoon)
    .replace(/\$\{settings\}/g, tr.settings)
    .replace(/\$\{skip\}/g, tr.skip)

    .replace(/\$\{setupGuide\}/g, setupGuide)
    .replace(/\$\{finishButton\}/g, finishButton);
}

