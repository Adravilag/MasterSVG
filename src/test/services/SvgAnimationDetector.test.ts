import { SvgAnimationDetector } from '../../services/svg/SvgAnimationDetector';

describe('SvgAnimationDetector', () => {
  describe('detectFromContent', () => {
    it('should return null for empty string', () => {
      expect(SvgAnimationDetector.detectFromContent('')).toBeNull();
    });

    it('should return null for SVG without animations', () => {
      const svg = '<svg><path d="M0 0h24v24H0z"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBeNull();
    });

    it('should detect CSS spin animation from @keyframes', () => {
      const svg = '<svg><style>@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }</style><circle animation: spin 1s linear infinite/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('spin (CSS)');
    });

    it('should detect CSS pulse animation', () => {
      const svg = '<svg><style>@keyframes pulse { 0% { opacity: 1 } 50% { opacity: 0.5 } }</style><circle style="animation: pulse 1s ease"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('pulse (CSS)');
    });

    it('should detect CSS fade animation from keyframes opacity', () => {
      const svg = '<svg><style>@keyframes fadeAnim { 0% { opacity: 0 } 100% { opacity: 1 } }</style><circle style="animation: fadeAnim 1s"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('fade (CSS)');
    });

    it('should detect CSS bounce animation', () => {
      const svg = '<svg><style>@keyframes bounce { 0% { transform: translateY(0) } }</style><circle style="animation: bounce 1s"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('bounce (CSS)');
    });

    it('should detect CSS shake animation', () => {
      const svg = '<svg><style>@keyframes shake { 0% { transform: translateX(0) } }</style><circle style="animation: shake 0.5s"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('shake (CSS)');
    });

    it('should detect CSS draw animation', () => {
      const svg = '<svg><style>@keyframes draw { to { stroke-dashoffset: 0 } }</style><path style="animation: draw 2s"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('draw (CSS)');
    });

    it('should detect generic CSS animation when type is unknown', () => {
      const svg = '<svg><style>@keyframes custom { 0% { fill: red } 100% { fill: blue } }</style><circle style="animation: custom 1s"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('CSS');
    });

    it('should detect inline animation property', () => {
      const svg = '<svg><circle style="animation: spin 1s linear infinite"/></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('spin (CSS)');
    });

    it('should detect SMIL animate element', () => {
      const svg = '<svg><circle><animate attributeName="r" values="5;10;5" dur="1s"/></circle></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('SMIL');
    });

    it('should detect SMIL animateTransform', () => {
      const svg = '<svg><circle><animateTransform attributeName="transform" type="rotate" values="0;360" dur="1s"/></circle></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('SMIL transform');
    });

    it('should detect SMIL animateMotion', () => {
      const svg = '<svg><circle><animateMotion path="M0,0 L100,100" dur="2s"/></circle></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('SMIL motion');
    });

    it('should detect SMIL set element', () => {
      const svg = '<svg><circle><set attributeName="fill" to="red" begin="1s"/></circle></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('SMIL');
    });

    it('should prioritize CSS over SMIL when both present', () => {
      const svg = '<svg><style>@keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }</style><circle style="animation: spin 1s"><animate attributeName="r" values="5;10"/></circle></svg>';
      expect(SvgAnimationDetector.detectFromContent(svg)).toBe('spin (CSS)');
    });
  });

  describe('detectNativeAnimation', () => {
    it('should return null for SVG without SMIL', () => {
      const svg = '<svg><circle cx="50" cy="50" r="25"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBeNull();
    });

    it('should detect native-rotate from animateTransform', () => {
      const svg = '<svg><animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native-rotate');
    });

    it('should detect native-scale from animateTransform', () => {
      const svg = '<svg><animateTransform attributeName="transform" type="scale" values="1;1.5;1"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native-scale');
    });

    it('should detect native-transform when type is not specified', () => {
      const svg = '<svg><animateTransform attributeName="transform"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native-transform');
    });

    it('should detect native-motion from animateMotion', () => {
      const svg = '<svg><animateMotion path="M0,0 C10,20 30,20 40,0"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native-motion');
    });

    it('should detect native-animate from animate element', () => {
      const svg = '<svg><animate attributeName="opacity" values="0;1" dur="1s"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native-animate');
    });

    it('should detect native from set element', () => {
      const svg = '<svg><set attributeName="fill" to="red" begin="click"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native');
    });

    it('should prioritize animateTransform over animate', () => {
      const svg = '<svg><animateTransform type="rotate" values="0;360"/><animate attributeName="opacity" values="0;1"/></svg>';
      expect(SvgAnimationDetector.detectNativeAnimation(svg)).toBe('native-rotate');
    });
  });
});
