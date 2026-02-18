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
  separateOutputStructure?: boolean;
  tr: Record<string, string>;
}

/** Internal preview options */
interface PreviewOptions {
  badge: string;
  comp: string;
  dir: string;
  file: string;
  tr: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

/** Shortcut to build a single code-line with line number */
function ln(n: number, content: string): string {
  return `<div class="code-line"><span class="line-num">${n}</span><span class="code-content">${content}</span></div>`;
}

/** Builds a comment span — JS style */
function cmt(text: string): string { return `<span class="comment">// ${text}</span>`; }

/** Builds an HTML comment span */
function htmlCmt(text: string): string { return `<span class="comment">&lt;!-- ${text} --&gt;</span>`; }

/** Keyword span */
function kw(text: string): string { return `<span class="keyword">${text}</span>`; }

/** Tag span */
function tag(text: string): string { return `<span class="tag">${text}</span>`; }

/** Attribute span */
function attr(text: string): string { return `<span class="attr">${text}</span>`; }

/** Value/string span */
function val(text: string): string { return `<span class="value">${text}</span>`; }

/** Decorator span */
function dec(text: string): string { return `<span class="decorator">${text}</span>`; }

/** Builds a self-closing JSX/HTML component line */
function jsxSelf(n: number, comp: string, attrs: string, indent = ''): string {
  return ln(n, `${indent}${tag(`&lt;${comp}`)}${attrs}${tag(' /&gt;')}`);
}

/** Builds an open+close HTML component line */
function htmlTag(n: number, sel: string, attrs: string, indent = ''): string {
  return ln(n, `${indent}${tag(`&lt;${sel}`)}${attrs}${tag(`&gt;&lt;/${sel}&gt;`)}`);
}

/** Output files info section */
function outputFilesInfo(files: string[], label: string): string {
  const items = files.map(f => `<span class="output-file-item"><svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>${f}</span>`).join('');
  return `<div class="output-files-info"><span class="output-files-label">${label}</span><div class="output-files-list">${items}</div></div>`;
}

// ═══════════════════════════════════════════════════════════
// MAIN ENTRY
// ═══════════════════════════════════════════════════════════

/**
 * Gets the appropriate framework preview based on build format and framework
 */
export function getFrameworkPreview(options: FrameworkPreviewOptions): string {
  const { buildFormat, framework, outputDirDisplay, webComponentDisplay, separateOutputStructure, tr } = options;

  if (!buildFormat) {
    return getEmptyPreviewPlaceholder(tr);
  }

  if (buildFormat === 'sprite.svg') {
    return getSpritePreview(outputDirDisplay, tr);
  }

  if (buildFormat === 'css') {
    return getCssPreview(outputDirDisplay, tr);
  }

  return getIconsPreview(framework as FrameworkType, outputDirDisplay, webComponentDisplay, Boolean(separateOutputStructure), tr);
}

/**
 * Gets the correct filename for the preview window title bar
 */
export function getPreviewWindowTitle(options: FrameworkPreviewOptions): string {
  const { buildFormat, framework, outputDirDisplay, webComponentDisplay } = options;

  if (!buildFormat) return 'example.js';
  if (buildFormat === 'sprite.svg') return 'index.html';
  if (buildFormat === 'css') return 'index.html';

  const wrapperService = FrameworkWrapperService.getInstance();
  switch (framework) {
    case 'react': return 'App.tsx';
    case 'vue': return 'App.vue';
    case 'svelte': return 'App.svelte';
    case 'angular': return 'app.component.ts';
    case 'astro': return 'index.astro';
    case 'solid': return 'App.tsx';
    case 'qwik': return 'App.tsx';
    case 'lit': return 'app.ts';
    default: {
      const comp = webComponentDisplay || wrapperService.getDefaultComponentName(framework as FrameworkType);
      return `${comp}.html`;
    }
  }
}

/**
 * Gets the list of output files that will be generated
 */
export function getOutputFilesList(buildFormat: string, framework: string, separateStructure: boolean): string[] {
  if (buildFormat === 'sprite.svg') {
    return ['sprite.svg', 'sprite.types.ts'];
  }
  if (buildFormat === 'css') {
    return ['icons.css', 'types.d.ts'];
  }
  // icons.js format
  const files = ['svg-data.ts', 'index.ts', 'types.d.ts'];
  const wrapperService = FrameworkWrapperService.getInstance();
  const wrapperFile = wrapperService.getWrapperFilename(framework as FrameworkType, 'Icon');
  files.push(wrapperFile);
  return files;
}

// ═══════════════════════════════════════════════════════════
// PLACEHOLDER
// ═══════════════════════════════════════════════════════════

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
        ${tr.step3Title}
      </p>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
// SPRITE PREVIEW
// ═══════════════════════════════════════════════════════════

function getSpritePreview(dir: string, tr: Record<string, string>): string {
  const filesHtml = outputFilesInfo(['sprite.svg', 'sprite.types.ts'], tr.workflowOutput || 'Output');
  return `${filesHtml}<div class="code-block">
${ln(1, htmlCmt(tr.previewRef))}
${ln(2, `${tag('&lt;svg')} ${attr('width')}=${val('"24"')} ${attr('height')}=${val('"24"')}${tag('&gt;')}`)}
${ln(3, `  ${tag('&lt;use')} ${attr('href')}=${val(`"${dir}/sprite.svg#home"`)} ${tag('/&gt;')}`)}
${ln(4, tag('&lt;/svg&gt;'))}
${ln(5, '')}
${ln(6, htmlCmt(`${tr.previewUse} — variant`))}
${ln(7, `${tag('&lt;svg')} ${attr('width')}=${val('"24"')} ${attr('height')}=${val('"24"')} ${attr('class')}=${val('"icon-heart"')}${tag('&gt;')}`)}
${ln(8, `  ${tag('&lt;use')} ${attr('href')}=${val(`"${dir}/sprite.svg#heart"`)} ${tag('/&gt;')}`)}
${ln(9, tag('&lt;/svg&gt;'))}
${ln(10, '')}
${ln(11, htmlCmt(`${tr.previewUse} — color + size`))}
${ln(12, `${tag('&lt;svg')} ${attr('width')}=${val('"32"')} ${attr('height')}=${val('"32"')} ${attr('fill')}=${val('"#e25555"')}${tag('&gt;')}`)}
${ln(13, `  ${tag('&lt;use')} ${attr('href')}=${val(`"${dir}/sprite.svg#check"`)} ${tag('/&gt;')}`)}
${ln(14, tag('&lt;/svg&gt;'))}
</div>`;
}

// ═══════════════════════════════════════════════════════════
// CSS ICONS PREVIEW
// ═══════════════════════════════════════════════════════════

function getCssPreview(dir: string, tr: Record<string, string>): string {
  const filesHtml = outputFilesInfo(['icons.css', 'types.d.ts'], tr.workflowOutput || 'Output');
  return `${filesHtml}<div class="code-block">
${ln(1, htmlCmt(tr.previewImport))}
${ln(2, `${tag('&lt;link')} ${attr('rel')}=${val('"stylesheet"')} ${attr('href')}=${val(`"${dir}/icons.css"`)}${tag(' /&gt;')}`)}
${ln(3, '')}
${ln(4, htmlCmt(tr.previewUse))}
${ln(5, `${tag('&lt;span')} ${attr('class')}=${val('"icon icon-home"')}${tag('&gt;&lt;/span&gt;')}`)}
${ln(6, `${tag('&lt;span')} ${attr('class')}=${val('"icon icon-heart"')}${tag('&gt;&lt;/span&gt;')}`)}
${ln(7, '')}
${ln(8, htmlCmt('currentColor — inherits parent color'))}
${ln(9, `${tag('&lt;nav')} ${attr('style')}=${val('"color: #e25555"')}${tag('&gt;')}`)}
${ln(10, `  ${tag('&lt;span')} ${attr('class')}=${val('"icon icon-settings"')}${tag('&gt;&lt;/span&gt;')} ${cmt('→ #e25555')}`)}
${ln(11, tag('&lt;/nav&gt;'))}
${ln(12, '')}
${ln(13, htmlCmt('Custom size via CSS variable'))}
${ln(14, `${tag('&lt;span')} ${attr('class')}=${val('"icon icon-check"')}`)}
${ln(15, `  ${attr('style')}=${val('"--icon-size: 32px"')}${tag('&gt;&lt;/span&gt;')}`)}
</div>`;
}

// ═══════════════════════════════════════════════════════════
// JS MODULE PREVIEWS — BY FRAMEWORK
// ═══════════════════════════════════════════════════════════

function getIconsPreview(
  selectedFramework: FrameworkType,
  outputDirDisplay: string,
  webComponentDisplay: string,
  separateStructure: boolean,
  tr: Record<string, string>
): string {
  const wrapperService = FrameworkWrapperService.getInstance();
  const frameworkBadge =
    selectedFramework !== 'html'
      ? `<div class="framework-badge">${selectedFramework.charAt(0).toUpperCase() + selectedFramework.slice(1)}</div>`
      : '';
  const wrapperFilename = wrapperService.getWrapperFilename(selectedFramework, webComponentDisplay);
  const componentImport = webComponentDisplay || wrapperService.getDefaultComponentName(selectedFramework);
  const outputFiles = getOutputFilesList('icons.js', selectedFramework, separateStructure);
  const displayFiles = separateStructure
    ? outputFiles.map(f => {
        if (f === 'svg-data.ts' || f === 'svg-data.js') return `assets/icons/svg-data.ts`;
        if (f === 'index.ts' || f === 'index.js') return `components/icons/index.ts`;
        if (f === 'types.d.ts' || f === 'types.ts') return `components/icons/types.d.ts`;
        return `components/icons/${f}`;
      })
    : outputFiles.map(f => `${outputDirDisplay}/${f}`);
  const filesHtml = outputFilesInfo(displayFiles, tr.workflowOutput || 'Output');

  const opts: PreviewOptions = {
    badge: frameworkBadge,
    comp: componentImport,
    dir: outputDirDisplay,
    file: wrapperFilename,
    tr,
  };

  switch (selectedFramework) {
    case 'react': return `${filesHtml}${getReactPreview(opts, separateStructure)}`;
    case 'vue': return `${filesHtml}${getVuePreview(opts, separateStructure)}`;
    case 'svelte': return `${filesHtml}${getSveltePreview(opts, separateStructure)}`;
    case 'angular': return `${filesHtml}${getAngularPreview({ ...opts, comp: webComponentDisplay }, separateStructure)}`;
    case 'astro': return `${filesHtml}${getAstroPreview(opts, separateStructure)}`;
    case 'solid': return `${filesHtml}${getSolidPreview(opts, separateStructure)}`;
    case 'qwik': return `${filesHtml}${getQwikPreview(opts, separateStructure)}`;
    case 'lit': return `${filesHtml}${getLitPreview({ ...opts, comp: webComponentDisplay }, separateStructure)}`;
    default: return `${filesHtml}${getHtmlPreview({ ...opts, comp: webComponentDisplay }, separateStructure)}`;
  }
}

// ─── React ───────────────────────────────────────────────

function getReactPreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  return `${badge}<div class="code-block">
${ln(1, cmt(tr.previewImport))}
${ln(2, `${kw('import')} { ${comp} } ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, '')}
${ln(4, `${kw('export default')} ${kw('function')} ${tag('App')}() {`)}
${ln(5, `  ${kw('return')} (`)}
${jsxSelf(6, comp, ` ${attr('name')}=${val('"home"')}`, '    ')}
${jsxSelf(7, comp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`, '    ')}
${jsxSelf(8, comp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`, '    ')}
${jsxSelf(9, comp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('{32}')} ${attr('color')}=${val('"#e25555"')}`, '    ')}
${ln(10, '  );')}
${ln(11, '}')}
</div>`;
}

// ─── Vue ─────────────────────────────────────────────────

function getVuePreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  return `${badge}<div class="code-block">
${ln(1, `${tag('&lt;script')} ${attr('setup')} ${attr('lang')}=${val('"ts"')}${tag('&gt;')}`)}
${ln(2, `${kw('import')} ${comp} ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, tag('&lt;/script&gt;'))}
${ln(4, '')}
${ln(5, tag('&lt;template&gt;'))}
${jsxSelf(6, comp, ` ${attr('name')}=${val('"home"')}`, '  ')}
${jsxSelf(7, comp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`, '  ')}
${jsxSelf(8, comp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`, '  ')}
${jsxSelf(9, comp, ` ${attr(':size')}=${val('"32"')} ${attr('color')}=${val('"#e25555"')}`, '  ')}
${ln(10, tag('&lt;/template&gt;'))}
</div>`;
}

// ─── Svelte ──────────────────────────────────────────────

function getSveltePreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  return `${badge}<div class="code-block">
${ln(1, `${tag('&lt;script')} ${attr('lang')}=${val('"ts"')}${tag('&gt;')}`)}
${ln(2, `  ${kw('import')} ${comp} ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, tag('&lt;/script&gt;'))}
${ln(4, '')}
${jsxSelf(5, comp, ` ${attr('name')}=${val('"home"')}`)}
${jsxSelf(6, comp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`)}
${jsxSelf(7, comp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`)}
${jsxSelf(8, comp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('{32}')} ${attr('color')}=${val('"#e25555"')}`)}
</div>`;
}

// ─── Angular ─────────────────────────────────────────────

function getAngularPreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  const sel = comp || 'app-icon';
  const cls = sel
    .split('-')
    .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('') + 'Component';
  return `${badge}<div class="code-block">
${ln(1, cmt('app.component.ts'))}
${ln(2, `${kw('import')} { ${cls} } ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, '')}
${ln(4, `${dec('@Component')}({`)}
${ln(5, `  ${attr('imports')}: [${cls}],`)}
${ln(6, '  ' + attr('template') + ': `')}
${htmlTag(7, sel, ` ${attr('name')}=${val('"home"')}`, '    ')}
${htmlTag(8, sel, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`, '    ')}
${htmlTag(9, sel, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`, '    ')}
${htmlTag(10, sel, ` ${attr('[size]')}=${val('"32"')} ${attr('color')}=${val('"#e25555"')}`, '    ')}
${ln(11, '  `')}
${ln(12, '})')}
</div>`;
}

// ─── Astro ───────────────────────────────────────────────

function getAstroPreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  return `${badge}<div class="code-block">
${ln(1, tag('---'))}
${ln(2, `${kw('import')} ${comp} ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, tag('---'))}
${ln(4, '')}
${jsxSelf(5, comp, ` ${attr('name')}=${val('"home"')}`)}
${jsxSelf(6, comp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`)}
${jsxSelf(7, comp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`)}
${jsxSelf(8, comp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('{32}')} ${attr('color')}=${val('"#e25555"')}`)}
</div>`;
}

// ─── Solid ───────────────────────────────────────────────

function getSolidPreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  return `${badge}<div class="code-block">
${ln(1, cmt(tr.previewImport))}
${ln(2, `${kw('import')} { ${comp} } ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, '')}
${ln(4, `${kw('export default')} ${kw('function')} ${tag('App')}() {`)}
${ln(5, `  ${kw('return')} (`)}
${jsxSelf(6, comp, ` ${attr('name')}=${val('"home"')}`, '    ')}
${jsxSelf(7, comp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`, '    ')}
${jsxSelf(8, comp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`, '    ')}
${jsxSelf(9, comp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('{32}')} ${attr('color')}=${val('"#e25555"')}`, '    ')}
${ln(10, '  );')}
${ln(11, '}')}
</div>`;
}

// ─── Qwik ────────────────────────────────────────────────

function getQwikPreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, file, tr } = opts;
  const importBase = file.replace(/\.(tsx|vue|svelte|ts|js)$/, '');
  const wrapperImport = separateStructure ? `${dir}/components/icons/${importBase}` : `${dir}/${importBase}`;
  return `${badge}<div class="code-block">
${ln(1, cmt(tr.previewImport))}
${ln(2, `${kw('import')} { component$ } ${kw('from')} ${val("'@builder.io/qwik'")};`)}
${ln(3, `${kw('import')} { ${comp} } ${kw('from')} ${val(`'${wrapperImport}'`)};`)}
${ln(4, '')}
${ln(5, `${kw('export default')} ${tag('component$')}(() =&gt; {`)}
${ln(6, `  ${kw('return')} (`)}
${jsxSelf(7, comp, ` ${attr('name')}=${val('"home"')}`, '    ')}
${jsxSelf(8, comp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`, '    ')}
${jsxSelf(9, comp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`, '    ')}
${jsxSelf(10, comp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('{32}')} ${attr('color')}=${val('"#e25555"')}`, '    ')}
${ln(11, '  );')}
${ln(12, '});')}
</div>`;
}

// ─── Lit ─────────────────────────────────────────────────

function getLitPreview(opts: PreviewOptions, separateStructure: boolean): string {
  const { badge, comp, dir, tr } = opts;
  const webComp = comp || 'svg-icon';
  const wrapperImport = separateStructure ? `${dir}/components/icons/Icon` : `${dir}/Icon`;
  return `${badge}<div class="code-block">
${ln(1, cmt(tr.previewImport))}
${ln(2, `${kw('import')} ${val(`'${wrapperImport}'`)};`)}
${ln(3, '')}
${ln(4, htmlCmt(tr.previewUse))}
${htmlTag(5, webComp, ` ${attr('name')}=${val('"home"')}`)}
${htmlTag(6, webComp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`)}
${htmlTag(7, webComp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`)}
${htmlTag(8, webComp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('"32"')} ${attr('color')}=${val('"#e25555"')}`)}
</div>`;
}

// ─── HTML (Web Component) ────────────────────────────────

function getHtmlPreview(opts: PreviewOptions, _separateStructure: boolean): string {
  const { comp, dir, tr } = opts;
  const webComp = comp || 'svg-icon';
  return `<div class="code-block">
${ln(1, htmlCmt(tr.previewImport))}
${ln(2, `${tag('&lt;script')} ${attr('src')}=${val(`"${dir}/icons.js"`)}${tag('&gt;&lt;/script&gt;')}`)}
${ln(3, `${tag('&lt;script')} ${attr('src')}=${val(`"${dir}/web-component.js"`)}${tag('&gt;&lt;/script&gt;')}`)}
${ln(4, '')}
${ln(5, htmlCmt(tr.previewUse))}
${htmlTag(6, webComp, ` ${attr('name')}=${val('"home"')}`)}
${htmlTag(7, webComp, ` ${attr('name')}=${val('"heart"')} ${attr('variant')}=${val('"custom"')}`)}
${htmlTag(8, webComp, ` ${attr('name')}=${val('"settings"')} ${attr('animation')}=${val('"spin"')}`)}
${htmlTag(9, webComp, ` ${attr('name')}=${val('"check"')} ${attr('size')}=${val('"32"')} ${attr('color')}=${val('"#e25555"')}`)}
</div>`;
}
