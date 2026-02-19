import * as fs from 'fs';
import * as path from 'path';
import { FrameworkType } from '../../utils/configHelper';
import * as generators from './generators';

/**
 * Configuración de extensiones y convenciones por framework
 */
const FRAMEWORK_CONFIG: Record<FrameworkType, { ext: string; casing: 'pascal' | 'kebab' }> = {
  react:   { ext: 'tsx', casing: 'pascal' },
  solid:   { ext: 'tsx', casing: 'pascal' },
  qwik:    { ext: 'tsx', casing: 'pascal' },
  vue:     { ext: 'vue', casing: 'pascal' },
  svelte:  { ext: 'svelte', casing: 'pascal' },
  astro:   { ext: 'astro', casing: 'pascal' },
  lit:     { ext: 'ts',  casing: 'kebab'  },
  angular: { ext: 'component.ts', casing: 'kebab' },
  html:    { ext: 'js',  casing: 'kebab'  },
};

export class FrameworkWrapperService {
  private static instance: FrameworkWrapperService;

  private constructor() { }

  public static getInstance(): FrameworkWrapperService {
    if (!FrameworkWrapperService.instance) {
      FrameworkWrapperService.instance = new FrameworkWrapperService();
    }
    return FrameworkWrapperService.instance;
  }

  /**
   * Genera y escribe el componente wrapper en el sistema de archivos.
   */
  public generateWrapper(outputPath: string, framework: FrameworkType, componentName: string): void {
    try {
      // 1. Validar y normalizar nombre del componente
      const normalizedName = this.prepareComponentName(framework, componentName);

      // 2. Obtener el generador correspondiente
      const generator = generators[framework];
      if (!generator) throw new Error(`Generador no encontrado para: ${framework}`);

      const content = generator(normalizedName);
      const filename = this.getWrapperFilename(framework, normalizedName);
      const filePath = path.join(outputPath, filename);

      // 3. Asegurar directorio y escribir archivo
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(`Error generando wrapper para ${framework}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Prepara el nombre según los requisitos del framework (ej. guion para Custom Elements)
   */
  private prepareComponentName(framework: FrameworkType, name: string): string {
    if (this.requiresHyphen(framework)) {
      const kebab = this.toKebabCase(name);
      return kebab.includes('-') ? kebab : `svg-${kebab}`;
    }
    return this.toPascalCase(name);
  }

  public getWrapperFilename(framework: FrameworkType, componentName: string): string {
    if (framework === 'html') return 'svg-element.js';
    const config = FRAMEWORK_CONFIG[framework] || { ext: 'js', casing: 'kebab' };
    const name = config.casing === 'pascal'
      ? this.toPascalCase(componentName)
      : this.toKebabCase(componentName);

    return `${name}${config.ext.startsWith('.') ? '' : '.'}${config.ext}`;
  }

  public getDefaultComponentName(framework: FrameworkType): string {
    return this.requiresHyphen(framework) ? 'svg-icon' : 'SvgIcon';
  }

  public getUsageExample(framework: FrameworkType, componentName: string): string {
    const name = this.prepareComponentName(framework, componentName);
    return this.requiresHyphen(framework) || framework === 'angular'
      ? `<${name} name="home"></${name}>`
      : `<${name} name="home" />`;
  }

  public requiresHyphen(framework: FrameworkType): boolean {
    return ['html', 'lit', 'angular'].includes(framework);
  }

  // --- Utilidades de Transformación de Texto ---

  private toKebabCase(str: string): string {
    return str
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[_\s]+/g, '-')
      .toLowerCase();
  }

  private toPascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }
}
