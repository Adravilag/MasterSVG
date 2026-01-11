import { AnimationService, ANIMATION_KEYFRAMES, AnimationSettings } from '../../services/AnimationService';

describe('AnimationService', () => {
  describe('ANIMATION_KEYFRAMES', () => {
    it('should have spin animation', () => {
      expect(ANIMATION_KEYFRAMES.spin).toBeDefined();
      expect(ANIMATION_KEYFRAMES.spin).toContain('@keyframes spin');
      expect(ANIMATION_KEYFRAMES.spin).toContain('rotate');
    });

    it('should have pulse animation', () => {
      expect(ANIMATION_KEYFRAMES.pulse).toBeDefined();
      expect(ANIMATION_KEYFRAMES.pulse).toContain('@keyframes pulse');
    });

    it('should have bounce animation', () => {
      expect(ANIMATION_KEYFRAMES.bounce).toBeDefined();
      expect(ANIMATION_KEYFRAMES.bounce).toContain('@keyframes bounce');
      expect(ANIMATION_KEYFRAMES.bounce).toContain('translate');
    });

    it('should have shake animation', () => {
      expect(ANIMATION_KEYFRAMES.shake).toBeDefined();
      expect(ANIMATION_KEYFRAMES.shake).toContain('@keyframes shake');
    });

    it('should have fade animation', () => {
      expect(ANIMATION_KEYFRAMES.fade).toBeDefined();
      expect(ANIMATION_KEYFRAMES.fade).toContain('@keyframes fade');
      expect(ANIMATION_KEYFRAMES.fade).toContain('opacity');
    });

    it('should have fade-in and fade-out animations', () => {
      expect(ANIMATION_KEYFRAMES['fade-in']).toBeDefined();
      expect(ANIMATION_KEYFRAMES['fade-out']).toBeDefined();
    });

    it('should have draw animations for SVG paths', () => {
      expect(ANIMATION_KEYFRAMES.draw).toBeDefined();
      expect(ANIMATION_KEYFRAMES['draw-reverse']).toBeDefined();
      expect(ANIMATION_KEYFRAMES['draw-loop']).toBeDefined();
      expect(ANIMATION_KEYFRAMES.draw).toContain('stroke-dashoffset');
    });

    it('should have heartbeat animation', () => {
      expect(ANIMATION_KEYFRAMES.heartbeat).toBeDefined();
      expect(ANIMATION_KEYFRAMES.heartbeat).toContain('scale');
    });

    it('should have glow animation', () => {
      expect(ANIMATION_KEYFRAMES.glow).toBeDefined();
      expect(ANIMATION_KEYFRAMES.glow).toContain('drop-shadow');
    });

    it('should have slide animations', () => {
      expect(ANIMATION_KEYFRAMES['slide-in-up']).toBeDefined();
      expect(ANIMATION_KEYFRAMES['slide-in-down']).toBeDefined();
      expect(ANIMATION_KEYFRAMES['slide-in-left']).toBeDefined();
      expect(ANIMATION_KEYFRAMES['slide-in-right']).toBeDefined();
    });

    it('should have zoom animations', () => {
      expect(ANIMATION_KEYFRAMES['zoom-in']).toBeDefined();
      expect(ANIMATION_KEYFRAMES['zoom-out']).toBeDefined();
    });
  });

  describe('getKeyframe', () => {
    it('should return keyframe for valid animation', () => {
      const keyframe = AnimationService.getKeyframe('spin');
      expect(keyframe).toBeDefined();
      expect(keyframe).toContain('@keyframes spin');
    });

    it('should return undefined for invalid animation', () => {
      const keyframe = AnimationService.getKeyframe('nonexistent');
      expect(keyframe).toBeUndefined();
    });

    it('should return correct keyframe for all standard animations', () => {
      const standardAnimations = ['spin', 'pulse', 'bounce', 'shake', 'fade'];
      for (const anim of standardAnimations) {
        const keyframe = AnimationService.getKeyframe(anim);
        expect(keyframe).toBeDefined();
        expect(keyframe).toContain(`@keyframes ${anim}`);
      }
    });
  });

  describe('getAnimationNames', () => {
    it('should return array of animation names', () => {
      const names = AnimationService.getAnimationNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
    });

    it('should include standard animations', () => {
      const names = AnimationService.getAnimationNames();
      expect(names).toContain('spin');
      expect(names).toContain('pulse');
      expect(names).toContain('bounce');
      expect(names).toContain('shake');
      expect(names).toContain('fade');
    });

    it('should include all keyframe keys', () => {
      const names = AnimationService.getAnimationNames();
      const keyframeKeys = Object.keys(ANIMATION_KEYFRAMES);
      expect(names).toEqual(keyframeKeys);
    });
  });
});

describe('AnimationSettings interface', () => {
  it('should accept valid settings', () => {
    const settings: AnimationSettings = {
      duration: 1000,
      timing: 'ease-in-out',
      iteration: 'infinite',
    };
    expect(settings.duration).toBe(1000);
    expect(settings.timing).toBe('ease-in-out');
    expect(settings.iteration).toBe('infinite');
  });

  it('should accept optional properties', () => {
    const settings: AnimationSettings = {
      duration: 500,
      timing: 'linear',
      iteration: '3',
      direction: 'alternate',
      delay: 200,
    };
    expect(settings.direction).toBe('alternate');
    expect(settings.delay).toBe(200);
  });
});
