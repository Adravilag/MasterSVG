/**
 * WelcomePanelI18n - Manages i18n labels for the WelcomePanel
 *
 * Centralizes all translation key access for the welcome wizard.
 */

import { t, SUPPORTED_LOCALES } from '../../i18n';
import { i18n } from '../../i18n';

function tOrFallback(key: string, fallbackKey: string): string {
  const v = t(key);
  if (!v || v === key) {
    return t(fallbackKey);
  }
  return v;
}

/**
 * Gets all i18n labels needed for the WelcomePanel
 */
export function getWelcomeI18n(frameworkAutoDetected: boolean): Record<string, string> {
  return {
    ...getBasicLabels(),
    ...getStepLabels(frameworkAutoDetected),
    ...getPreviewLabels(),
  };
}

/**
 * Gets basic UI labels
 */
function getBasicLabels(): Record<string, string> {
  return {
    languageLabel: t('welcome.language'),
    languageDescription: t('welcome.languageDescription'),
    appTitle: t('extension.appTitle'),
    headerIcons: '200k+ ' + t('treeView.files'),
    headerColors: t('editor.color') + ' ' + t('features.iconEditor').split(' ')[0],
    headerAnimations: t('animation.title'),
    headerSvgo: 'SVGO',
    buildOptionsTitle: t('welcome.buildOptions'),
    separateOutputLabel: t('welcome.separateOutputStructure'),
    separateOutputHint: t('welcome.separateOutputHint'),
    defaultIconSizeLabel: t('welcome.defaultIconSize'),
    previewBackgroundLabel: t('welcome.previewBackground'),
    codeIntegrationLabel: t('features.codeIntegration'),
    codeIntegrationHint: t('welcome.codeIntegrationHint'),
    codeIntegrationBadge: t('welcome.codeIntegrationBadge') || t('features.codeIntegrationDescription'),
    settings: t('settings.title'),
    skip: t('messages.cancel'),
    getStarted: t('welcome.getStarted'),
    completeStep1: t('welcome.save'),
    frontendDetected: t('welcome.frontendDetected'),
  };
}

/**
 * Gets step-related labels
 */
function getStepLabels(frameworkAutoDetected: boolean): Record<string, string> {
  return {
    step0Title: t('welcome.frontendRoot'),
    step0Desc: t('welcome.frontendRootDesc'),
    step1SourceTitle: t('welcome.sourceDirectory'),
    step1SourceDesc: t('welcome.sourceDirectoryDescription'),
    step1SourcePlaceholder: t('welcome.sourceDirectoryPlaceholder'),
    step1Apply: t('editor.apply'),
    browse: t('welcome.browse'),
    step2Title: t('welcome.outputDirectory'),
    step2Desc: t('welcome.outputDirectoryDescription'),
    step2Placeholder: t('welcome.outputDirectoryPlaceholder'),
    step3Title: t('settings.outputFormat'),
    step3Desc: t('features.buildSystemDescription'),
    step3Help: '?',
    frameworkLabel: frameworkAutoDetected
      ? `${t('settings.framework')} (${t('settings.frameworkAutoDetected')})`
      : t('settings.framework') || 'Target Framework',
    selectFormat: t('welcome.selectFormat'),
    jsModuleTitle: t('welcome.jsModule'),
    jsModuleDesc: t('features.codeIntegrationDescription'),
    jsModulePro1: t('editor.variants'),
    jsModulePro2: t('editor.custom'),
    spriteTitle: t('sprite.title'),
    spriteDesc: t('features.buildSystemDescription'),
    spritePro1: t('welcome.noRuntime'),
    spritePro2: t('sprite.title'),
    cssIconsTitle: t('welcome.cssIcons') || 'CSS Icons',
    cssIconsDesc: t('welcome.cssIconsDesc') || 'Pure CSS classes using mask-image, zero JS runtime',
    cssIconsPro1: t('welcome.cssIconsPro1') || 'Zero JS',
    cssIconsPro2: t('welcome.cssIconsPro2') || 'currentColor',
    helpCssIcons: t('welcome.helpCssIcons') || 'Pure CSS classes with mask-image',
    recommended: '⭐',
    comingSoon: t('welcome.comingSoon'),
    helpJsModule: t('features.codeIntegrationDescription'),
    helpSprite: t('features.buildSystemDescription'),
    transformTitle: t('commands.transform') || 'Transformar',
    transformDesc: t('features.buildSystemDescription'),
    transformPro1: tOrFallback('welcome.transformPro1', 'features.codeIntegrationDescription'),
    helpTip: t('welcome.quickStartDescription'),
    step4Title: '',
    step4Desc: '',
    step4Placeholder: '',
  };
}

/**
 * Gets preview-related labels
 */
function getPreviewLabels(): Record<string, string> {
  return {
    previewTitle: t('editor.preview'),
    previewImport: t('welcome.import'),
    previewUse: t('welcome.use'),
    previewRef: t('welcome.reference'),
    previewOutput: t('welcome.outputDirectory'),
    previewFormat: t('settings.outputFormat'),
    previewTag: t('welcome.tag'),
    previewResultLabel: t('welcome.previewResult'),
    buildFirstMessage: t('welcome.buildFirstMessage'),
    selectFormatFirst: t('welcome.selectFormatFirst'),
    workflowSource: t('welcome.workflowSource'),
    workflowBuild: t('welcome.workflowBuild'),
    workflowOutput: t('welcome.workflowOutput'),
    setupGuideTitle: t('welcome.setupGuideTitle'),
    setupBuildCmd: t('welcome.setupBuildCmd'),
    setupStepBuild: t('welcome.setupStepBuild'),
    setupStepImport: t('welcome.setupStepImport'),
    setupStepUse: t('welcome.setupStepUse'),
    setupStepStyle: t('welcome.setupStepStyle'),
    setupStepSpriteRef: t('welcome.setupStepSpriteRef'),
    setupStepCssLink: t('welcome.setupStepCssLink'),
    setupStepCssUse: t('welcome.setupStepCssUse'),
    setupStepBuildDesc: t('welcome.setupStepBuildDesc'),
    setupStepSpriteRefDesc: t('welcome.setupStepSpriteRefDesc'),
    setupStepStyleDesc: t('welcome.setupStepStyleDesc'),
    setupStepCssLinkDesc: t('welcome.setupStepCssLinkDesc'),
    setupStepCssUseDesc: t('welcome.setupStepCssUseDesc'),
    setupGuideTip: t('welcome.setupGuideTip'),
  };
}

/**
 * Builds language selector options HTML
 */
export function buildLanguageOptions(): string {
  const currentLocale = i18n.getConfiguredLocale();
  return SUPPORTED_LOCALES
    .map(locale => {
      const selected = locale.code === currentLocale ? 'selected' : '';
      const label =
        locale.code === 'auto'
          ? `${locale.flag} ${t('settings.languageAuto')}`
          : `${locale.flag} ${locale.nativeName}`;
      return `<option value="${locale.code}" ${selected}>${label}</option>`;
    })
    .join('\n          ');
}

/**
 * Gets step 4 title based on framework
 */
export function getStep4Title(framework: string): string {
  switch (framework) {
    case 'html':
      return t('welcome.webComponentName');
    case 'angular':
      return t('welcome.angularSelector');
    case 'lit':
      return t('welcome.webComponentName');
    default:
      return t('welcome.componentName');
  }
}

/**
 * Gets step 4 description based on framework
 */
export function getStep4Description(framework: string): string {
  switch (framework) {
    case 'html':
      return t('welcome.webComponentDesc');
    case 'angular':
      return t('welcome.angularSelectorDesc');
    case 'lit':
      return t('welcome.webComponentDesc');
    default:
      return t('welcome.componentNameDesc');
  }
}

/**
 * Gets step 4 placeholder based on framework
 */
export function getStep4Placeholder(framework: string): string {
  switch (framework) {
    case 'html':
      return 'svg-icon';
    case 'angular':
      return 'app-icon';
    case 'lit':
      return 'svg-icon';
    default:
      return 'Icon';
  }
}
