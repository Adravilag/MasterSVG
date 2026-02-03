import { SvgManipulationService } from '../../services/svg/SvgManipulationService';
import { AnimationSettings } from '../../services/animation/AnimationService';

describe('SvgManipulationService', () => {
  // =====================================================
  // ensureSvgNamespace
  // =====================================================
  describe('ensureSvgNamespace', () => {
    test('debe agregar xmlns si no existe', () => {
      const input = '<svg viewBox="0 0 24 24"><path d="M10 10"/></svg>';
      const result = SvgManipulationService.ensureSvgNamespace(input);
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    test('no debe duplicar xmlns si ya existe', () => {
      const input = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
      const result = SvgManipulationService.ensureSvgNamespace(input);
      const matches = result.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g);
      expect(matches?.length).toBe(1);
    });

    test('debe corregir xmlns si está mal formado o duplicado (fallback regex)', () => {
      const input =
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"></svg>';
      const result = SvgManipulationService.ensureSvgNamespace(input);
      const matches = result.match(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g);
      expect(matches?.length).toBe(1);
    });

    test('debe manejar SVGs inválidos usando fallback regex', () => {
      const input = '<svg viewBox="0 0 24 24"><unclosed-tag>';
      const result = SvgManipulationService.ensureSvgNamespace(input);
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
  });

  // =====================================================
  // cleanAnimationFromSvg
  // =====================================================
  describe('cleanAnimationFromSvg', () => {
    test('debe eliminar estilos con id icon-manager-animation', () => {
      const input = '<svg><style id="icon-manager-animation">.anim{}</style><path/></svg>';
      const result = SvgManipulationService.cleanAnimationFromSvg(input);
      expect(result).not.toContain('icon-manager-animation');
      expect(result).not.toContain('.anim{}');
    });

    test('debe eliminar scripts con id icon-manager-script', () => {
      const input = '<svg><script id="icon-manager-script">console.log("hi")</script><path/></svg>';
      const result = SvgManipulationService.cleanAnimationFromSvg(input);
      expect(result).not.toContain('icon-manager-script');
      expect(result).not.toContain('console.log');
    });

    test('debe eliminar estilos legacy (sin id pero con keyframes)', () => {
      const input =
        '<svg><style>@keyframes spin { from { transform: rotate(0deg); } } svg { animation: spin 1s; }</style></svg>';
      const result = SvgManipulationService.cleanAnimationFromSvg(input);
      expect(result).not.toContain('@keyframes spin');
    });

    test('debe manejar SVGs mal formados usando fallback regex', () => {
      const input = '<svg><style id="icon-manager-animation">bad</style><broken-tag>';
      const result = SvgManipulationService.cleanAnimationFromSvg(input);
      expect(result).not.toContain('icon-manager-animation');
    });
  });

  // =====================================================
  // embedAnimationInSvg
  // =====================================================
  describe('embedAnimationInSvg', () => {
    const settings: AnimationSettings = {
      duration: 2,
      timing: 'linear',
      iteration: 'infinite',
      direction: 'normal',
      delay: 0,
    };

    test('debe inyectar estilo de animación estándar', () => {
      const input = '<svg viewBox="0 0 24 24"><path/></svg>';
      const result = SvgManipulationService.embedAnimationInSvg(input, 'spin', settings);

      expect(result).toContain('id="icon-manager-animation"');
      expect(result).toContain('@keyframes spin');
      expect(result).toContain('animation: spin 2s linear infinite normal');
    });

    test('debe inyectar animación draw (style + script)', () => {
      const input = '<svg viewBox="0 0 24 24"><path/></svg>';
      const result = SvgManipulationService.embedAnimationInSvg(input, 'draw', settings);

      expect(result).toContain('id="icon-manager-animation"');
      expect(result).toContain('id="icon-manager-script"');
      expect(result).toContain('@keyframes draw');
      expect(result).toContain('stroke-dasharray');
    });

    test('debe inyectar animación draw-loop', () => {
      const input = '<svg viewBox="0 0 24 24"><path/></svg>';
      const result = SvgManipulationService.embedAnimationInSvg(input, 'draw-loop', settings);

      expect(result).toContain('@keyframes draw-loop');
      expect(result).toContain('animation: draw-loop');
    });

    test('debe limpiar animaciones previas antes de inyectar nueva', () => {
      const input = '<svg><style id="icon-manager-animation">old</style><path/></svg>';
      const result = SvgManipulationService.embedAnimationInSvg(input, 'pulse', settings);

      expect(result).not.toContain('old');
      expect(result).toContain('@keyframes pulse');
    });

    test('debe manejar SVGs inválidos usando fallback regex', () => {
      // SVG con estructura malformada pero con tags de apertura y cierre
      const input = '<svg><broken attr=></svg>';
      const result = SvgManipulationService.embedAnimationInSvg(input, 'spin', settings);

      expect(result).toContain('id="icon-manager-animation"');
      expect(result).toContain('@keyframes spin');
    });
  });

  // =====================================================
  // detectAnimationFromSvg
  // =====================================================
  describe('detectAnimationFromSvg', () => {
    test('debe detectar animación estándar', () => {
      const input =
        '<svg><style>@keyframes spin {} svg { animation: spin 2s linear 0s infinite normal; }</style></svg>';
      const result = SvgManipulationService.detectAnimationFromSvg(input);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('spin');
      expect(result?.settings.duration).toBe(2);
      expect(result?.settings.timing).toBe('linear');
    });

    test('debe detectar animación draw', () => {
      const input = '<svg><style>@keyframes draw {}</style></svg>';
      const result = SvgManipulationService.detectAnimationFromSvg(input);

      expect(result?.type).toBe('draw');
    });

    test('debe detectar animación draw-loop', () => {
      const input = '<svg><style>@keyframes draw-loop {}</style></svg>';
      const result = SvgManipulationService.detectAnimationFromSvg(input);

      expect(result?.type).toBe('draw-loop');
    });

    test('debe retornar null si no hay animación', () => {
      const input = '<svg><path/></svg>';
      const result = SvgManipulationService.detectAnimationFromSvg(input);

      expect(result).toBeNull();
    });
  });
});
