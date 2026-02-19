import { toPascalCase, getAnimationKeyframesString } from '../utils/componentHelpers';

/**
 * Fragmento de la lógica interna de la clase para reducir el tamaño de la función principal
 */
const getAngularClassLogic = () => `
  @ViewChild('svgRef') svgRef!: ElementRef<SVGSVGElement>;
  private sanitizer = inject(DomSanitizer);
  private animationPlayer?: Animation;
  icon: any;
  safeBody?: SafeHtml;

  get sizeValue() { return typeof this.size === 'number' ? \`\${this.size}px\` : this.size; }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['name'] || changes['animation']) {
      this.icon = icons[this.name];
      this.safeBody = this.icon ? this.sanitizer.bypassSecurityTrustHtml(this.icon.body) : '';
      setTimeout(() => this.applyAnimation());
    }
  }

  private applyAnimation() {
    if (!this.svgRef || !this.icon) return;
    this.animationPlayer?.cancel();
    const config = this.animation ? { type: this.animation, duration: 1000 } : this.icon.animation;
    if (config && ANIMATION_KEYFRAMES[config.type]) {
      this.animationPlayer = this.svgRef.nativeElement.animate(
        ANIMATION_KEYFRAMES[config.type],
        { duration: config.duration || 1000, iterations: Infinity }
      );
    }
  }`;

export function generateAngularComponent(nameArg: string): string {
  const className = `${toPascalCase(nameArg)}Component`;
  const selector = nameArg.toLowerCase().replace(/_/g, '-');
  const animKeys = getAnimationKeyframesString();

  return `import { Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { icons } from './svg-data';

${animKeys}

@Component({
  selector: '${selector}',
  standalone: true,
  template: \`<svg #svgRef [attr.viewBox]="icon?.viewBox" [attr.width]="sizeValue" [attr.height]="sizeValue" [attr.fill]="color" [class]="className" [ngStyle]="style" [innerHTML]="safeBody"></svg>\`,
  styles: [':host { display: inline-block; }']
})
export class ${className} implements OnChanges {
  @Input() name!: string;
  @Input() size: string | number = '1em';
  @Input() color: string = 'currentColor';
  @Input() animation?: keyof typeof ANIMATION_KEYFRAMES;
  @Input() className: string = '';
  @Input() style: Record<string, string> = {};
${getAngularClassLogic()}
}`;
}
