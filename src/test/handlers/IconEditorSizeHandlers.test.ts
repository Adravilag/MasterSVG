/**
 * Tests para IconEditorSizeHandlers
 * Verifican la extracción de dimensiones, cambio de tamaño y eliminación de atributos
 */

import {
  extractSvgDimensions,
  getViewBoxDimensions,
  parseDimensionValue,
  handleChangeSize,
  handleRemoveSize,
  SizeHandlerContext,
} from '../../handlers/IconEditorSizeHandlers';

describe('IconEditorSizeHandlers', () => {
  describe('extractSvgDimensions', () => {
    it('should_ExtractWidthAndHeight_When_AttributesPresent', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0"/></svg>';
      const dims = extractSvgDimensions(svg);

      expect(dims.width).toBe('24');
      expect(dims.height).toBe('24');
      expect(dims.viewBox).toBe('0 0 24 24');
    });

    it('should_ReturnNull_When_NoWidthHeight', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="M0 0"/></svg>';
      const dims = extractSvgDimensions(svg);

      expect(dims.width).toBeNull();
      expect(dims.height).toBeNull();
      expect(dims.viewBox).toBe('0 0 32 32');
    });

    it('should_HandleUnitsInDimensions_When_PxSpecified', () => {
      const svg = '<svg width="48px" height="48px" viewBox="0 0 48 48"><path d="M0 0"/></svg>';
      const dims = extractSvgDimensions(svg);

      expect(dims.width).toBe('48px');
      expect(dims.height).toBe('48px');
    });

    it('should_ReturnNullViewBox_When_NotPresent', () => {
      const svg = '<svg width="24" height="24"><path d="M0 0"/></svg>';
      const dims = extractSvgDimensions(svg);

      expect(dims.width).toBe('24');
      expect(dims.height).toBe('24');
      expect(dims.viewBox).toBeNull();
    });
  });

  describe('getViewBoxDimensions', () => {
    it('should_ParseViewBox_When_ValidFormat', () => {
      const result = getViewBoxDimensions('0 0 32 32');
      expect(result.width).toBe(32);
      expect(result.height).toBe(32);
    });

    it('should_ReturnDefaults_When_NullViewBox', () => {
      const result = getViewBoxDimensions(null);
      expect(result.width).toBe(24);
      expect(result.height).toBe(24);
    });

    it('should_HandleNonSquareViewBox_When_DifferentDimensions', () => {
      const result = getViewBoxDimensions('0 0 100 50');
      expect(result.width).toBe(100);
      expect(result.height).toBe(50);
    });

    it('should_HandleNegativeOrigin_When_ViewBoxHasOffset', () => {
      const result = getViewBoxDimensions('-10 -10 200 100');
      expect(result.width).toBe(200);
      expect(result.height).toBe(100);
    });
  });

  describe('parseDimensionValue', () => {
    it('should_ParseNumericString_When_ValidNumber', () => {
      expect(parseDimensionValue('24')).toBe(24);
      expect(parseDimensionValue('48.5')).toBe(48.5);
    });

    it('should_ParseWithUnits_When_PxSuffix', () => {
      expect(parseDimensionValue('24px')).toBe(24);
      expect(parseDimensionValue('16em')).toBe(16);
    });

    it('should_ReturnNull_When_NullInput', () => {
      expect(parseDimensionValue(null)).toBeNull();
    });

    it('should_ReturnNull_When_InvalidString', () => {
      expect(parseDimensionValue('abc')).toBeNull();
    });
  });

  describe('handleChangeSize', () => {
    let ctx: SizeHandlerContext;
    let messages: unknown[];
    let savedSvg: string | undefined;

    beforeEach(() => {
      messages = [];
      savedSvg = undefined;

      ctx = {
        iconData: {
          name: 'test-icon',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
        },
        postMessage: (msg: unknown) => messages.push(msg),
        processAndSaveIcon: jest.fn(async (options) => {
          savedSvg = options.svg;
        }),
      };
    });

    it('should_SetDimensions_When_ValidSizeProvided', async () => {
      await handleChangeSize(ctx, { width: 32, height: 32 });

      expect(ctx.processAndSaveIcon).toHaveBeenCalledTimes(1);
      const callArgs = (ctx.processAndSaveIcon as jest.Mock).mock.calls[0][0];
      expect(callArgs.svg).toContain('width="32"');
      expect(callArgs.svg).toContain('height="32"');
    });

    it('should_ReplaceDimensions_When_ExistingAttributesPresent', async () => {
      ctx.iconData!.svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0"/></svg>';

      await handleChangeSize(ctx, { width: 48, height: 48 });

      const callArgs = (ctx.processAndSaveIcon as jest.Mock).mock.calls[0][0];
      expect(callArgs.svg).toContain('width="48"');
      expect(callArgs.svg).toContain('height="48"');
      // Should not contain old dimensions
      expect(callArgs.svg).not.toContain('width="24"');
    });

    it('should_NotProcess_When_InvalidDimensions', async () => {
      await handleChangeSize(ctx, { width: 0, height: 32 });
      expect(ctx.processAndSaveIcon).not.toHaveBeenCalled();

      await handleChangeSize(ctx, { width: 32, height: -1 });
      expect(ctx.processAndSaveIcon).not.toHaveBeenCalled();

      await handleChangeSize(ctx, { width: 3000, height: 32 });
      expect(ctx.processAndSaveIcon).not.toHaveBeenCalled();
    });

    it('should_NotProcess_When_NoIconData', async () => {
      ctx.iconData = undefined;
      await handleChangeSize(ctx, { width: 32, height: 32 });
      expect(ctx.processAndSaveIcon).not.toHaveBeenCalled();
    });

    it('should_SupportNonSquareDimensions_When_DifferentWidthHeight', async () => {
      await handleChangeSize(ctx, { width: 64, height: 32 });

      const callArgs = (ctx.processAndSaveIcon as jest.Mock).mock.calls[0][0];
      expect(callArgs.svg).toContain('width="64"');
      expect(callArgs.svg).toContain('height="32"');
    });
  });

  describe('handleRemoveSize', () => {
    let ctx: SizeHandlerContext;

    beforeEach(() => {
      ctx = {
        iconData: {
          name: 'test-icon',
          svg: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M0 0"/></svg>',
        },
        postMessage: jest.fn(),
        processAndSaveIcon: jest.fn(async () => {}),
      };
    });

    it('should_RemoveDimensions_When_AttributesPresent', async () => {
      await handleRemoveSize(ctx);

      const callArgs = (ctx.processAndSaveIcon as jest.Mock).mock.calls[0][0];
      expect(callArgs.svg).not.toContain('width=');
      expect(callArgs.svg).not.toContain('height=');
      expect(callArgs.svg).toContain('viewBox');
    });

    it('should_NotProcess_When_NoIconData', async () => {
      ctx.iconData = undefined;
      await handleRemoveSize(ctx);
      expect(ctx.processAndSaveIcon).not.toHaveBeenCalled();
    });

    it('should_HandleSvgWithoutDimensions_When_AlreadyAbsent', async () => {
      ctx.iconData!.svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0"/></svg>';

      await handleRemoveSize(ctx);

      const callArgs = (ctx.processAndSaveIcon as jest.Mock).mock.calls[0][0];
      expect(callArgs.svg).not.toContain('width=');
      expect(callArgs.svg).not.toContain('height=');
    });
  });
});
