/**
 * WelcomePanelPreviews - Code preview generators for different frameworks
 *
 * Generates syntax-highlighted code previews for each supported framework.
 */

import { FrameworkType } from '../../services/types';
import { FrameworkWrapperService } from '../../services/framework';

/** Options for generating framework previews */
export interface FrameworkPreviewOptions {
  buildFormat: string;
  framework: string;
  outputDirDisplay: string;
  webComponentDisplay: string;
  tr: Record<string, string>;
}

/** Internal preview options */
interface PreviewOptions {
  badge: string;
  comp: string;
  dir: string;
  file: string;
  tr?: Record<string, string>;
}

/**
 * Gets the appropriate framework preview based on build format and framework
 */
export function getFrameworkPreview(options: FrameworkPreviewOptions): string {
  const { buildFormat, framework, outputDirDisplay, webComponentDisplay, tr } = options;

  if (!buildFormat) {
    return getEmptyPreviewPlaceholder(tr);
  }

  if (buildFormat === 'sprite.svg') {
    return getSpritePreview(outputDirDisplay, tr);
  }

  return getIconsPreview(framework as FrameworkType, outputDirDisplay, webComponentDisplay, tr);
}

/**
 * Gets empty preview placeholder when no format is selected
 */
function getEmptyPreviewPlaceholder(tr: Record<string, string>): string {
  return `<div class="preview-placeholder">
      <div class="preview-placeholder-icon">
        <svg viewBox="0 0 24 24">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
        </svg>
      </div>
      <p class="preview-placeholder-text">${tr.selectFormatFirst}</p>
      <p class="preview-placeholder-hint">
        <svg viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        Paso 1
      </p>
    </div>`;
}

/**
 * Gets sprite preview HTML
 */
function getSpritePreview(outputDirDisplay: string, tr: Record<string, string>): string {
  return `<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">&lt;!-- ${tr.previewRef} --&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="tag">&lt;svg</span> <span class="attr">width</span>=<span class="value">"24"</span> <span class="attr">height</span>=<span class="value">"24"</span><span class="tag">&gt;</span></div>
<div class="code-line"><span class="line-num">3</span>  <span class="tag">&lt;use</span> <span class="attr">href</span>=<span class="value">"${outputDirDisplay}/sprite.svg#home"</span> <span class="tag">/&gt;</span></div>
<div class="code-line"><span class="line-num">4</span><span class="tag">&lt;/svg&gt;</span></div>
</div>`;
}

/**
 * Gets icons preview for specific framework
 */
function getIconsPreview(
  selectedFramework: FrameworkType,
  outputDirDisplay: string,
  webComponentDisplay: string,
  tr: Record<string, string>
): string {
  const wrapperService = FrameworkWrapperService.getInstance();
  const frameworkBadge =
    selectedFramework !== 'html'
      ? `<div class="framework-badge">${selectedFramework.charAt(0).toUpperCase() + selectedFramework.slice(1)}</div>`
      : '';
  const wrapperFilename = wrapperService.getWrapperFilename(selectedFramework, webComponentDisplay);
  const componentImport = webComponentDisplay || wrapperService.getDefaultComponentName(selectedFramework);

  switch (selectedFramework) {
    case 'react':
      return getReactPreview({
        badge: frameworkBadge,
        comp: componentImport,
        dir: outputDirDisplay,
        file: wrapperFilename,
        tr,
      });
    case 'vue':
      return getVuePreview(frameworkBadge, componentImport, outputDirDisplay, wrapperFilename);
    case 'svelte':
      return getSveltePreview(frameworkBadge, componentImport, outputDirDisplay, wrapperFilename);
    case 'angular':
      return getAngularPreview(frameworkBadge, webComponentDisplay, outputDirDisplay, wrapperFilename);
    case 'astro':
      return getAstroPreview(frameworkBadge, componentImport, outputDirDisplay, wrapperFilename);
    case 'solid':
      return getSolidPreview({
        badge: frameworkBadge,
        comp: componentImport,
        dir: outputDirDisplay,
        file: wrapperFilename,
        tr,
      });
    case 'qwik':
      return getQwikPreview({
        badge: frameworkBadge,
        comp: componentImport,
        dir: outputDirDisplay,
        file: wrapperFilename,
        tr,
      });
    default:
      return getHtmlPreview(webComponentDisplay, outputDirDisplay, tr);
  }
}

function getReactPreview(opts: PreviewOptions): string {
  const { badge, comp, dir, file, tr } = opts;
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr?.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${comp} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.tsx', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr?.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
}

function getVuePreview(badge: string, comp: string, dir: string, file: string): string {
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">&lt;script</span><span class="attr"> setup</span><span class="tag">&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> ${comp} <span class="keyword">from</span> <span class="value">'${dir}/${file}'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;template&gt;</span></div>
<div class="code-line"><span class="line-num">6</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">9</span>  <span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> :size</span>=<span class="value">"32"</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">10</span><span class="tag">&lt;/template&gt;</span></div>
</div>`;
}

function getSveltePreview(badge: string, comp: string, dir: string, file: string): string {
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">&lt;script&gt;</span></div>
<div class="code-line"><span class="line-num">2</span>  <span class="keyword">import</span> ${comp} <span class="keyword">from</span> <span class="value">'${dir}/${file}'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
}

function getAngularPreview(badge: string, webComp: string, dir: string, file: string): string {
  const sel = webComp || 'app-icon';
  const cls = sel
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('') + 'Component';
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// app.component.ts</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${cls} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.ts', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="decorator">@Component</span>({<span class="attr"> imports</span>: [${cls}] })</div>
<div class="code-line"><span class="line-num">5</span></div>
<div class="code-line"><span class="line-num">6</span><span class="comment">&lt;!-- template.html --&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${sel}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${sel}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
<div class="code-line"><span class="line-num">9</span><span class="tag">&lt;${sel}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
<div class="code-line"><span class="line-num">10</span><span class="tag">&lt;${sel}</span><span class="attr"> [size]</span>=<span class="value">"32"</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag">&gt;&lt;/${sel}&gt;</span></div>
</div>`;
}

function getAstroPreview(badge: string, comp: string, dir: string, file: string): string {
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="tag">---</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> ${comp} <span class="keyword">from</span> <span class="value">'${dir}/${file}'</span>;</div>
<div class="code-line"><span class="line-num">3</span><span class="tag">---</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
}

function getSolidPreview(opts: PreviewOptions): string {
  const { badge, comp, dir, file, tr } = opts;
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr?.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${comp} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.tsx', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr?.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
}

function getQwikPreview(opts: PreviewOptions): string {
  const { badge, comp, dir, file, tr } = opts;
  return `${badge}<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">// ${tr?.previewImport}</span></div>
<div class="code-line"><span class="line-num">2</span><span class="keyword">import</span> { ${comp} } <span class="keyword">from</span> <span class="value">'${dir}/${file.replace('.tsx', '')}'</span>;</div>
<div class="code-line"><span class="line-num">3</span></div>
<div class="code-line"><span class="line-num">4</span><span class="comment">// ${tr?.previewUse}</span></div>
<div class="code-line"><span class="line-num">5</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag"> /&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${comp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">{32}</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag"> /&gt;</span></div>
</div>`;
}

function getHtmlPreview(webComp: string, dir: string, tr: Record<string, string>): string {
  return `<div class="code-block">
<div class="code-line"><span class="line-num">1</span><span class="comment">&lt;!-- ${tr.previewImport} --&gt;</span></div>
<div class="code-line"><span class="line-num">2</span><span class="tag">&lt;script</span><span class="attr"> src</span>=<span class="value">"${dir}/icons.js"</span><span class="tag">&gt;&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">3</span><span class="tag">&lt;script</span><span class="attr"> src</span>=<span class="value">"${dir}/web-component.js"</span><span class="tag">&gt;&lt;/script&gt;</span></div>
<div class="code-line"><span class="line-num">4</span></div>
<div class="code-line"><span class="line-num">5</span><span class="comment">&lt;!-- ${tr.previewUse} --&gt;</span></div>
<div class="code-line"><span class="line-num">6</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"home"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
<div class="code-line"><span class="line-num">7</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"heart"</span><span class="attr"> variant</span>=<span class="value">"custom"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
<div class="code-line"><span class="line-num">8</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"settings"</span><span class="attr"> animation</span>=<span class="value">"spin"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
<div class="code-line"><span class="line-num">9</span><span class="tag">&lt;${webComp}</span><span class="attr"> name</span>=<span class="value">"check"</span><span class="attr"> size</span>=<span class="value">"32"</span><span class="attr"> color</span>=<span class="value">"#e25555"</span><span class="tag">&gt;&lt;/${webComp}&gt;</span></div>
</div>`;
}
