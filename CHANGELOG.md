# Changelog

All notable changes to the "MasterSVG" extension will be documented in this file.

## [0.2.0] - 2026-01-11

### ⚠️ Breaking Changes
- 📁 Changed default output directory from `mastersvg-icons` to `icons`
- 📄 Renamed output files for clarity:
	- `icons.js` → `svg-data.js`
	- `icon.js` → `svg-element.js`
	- `variants.js` → `svg-variants.js`
- 🏷️ Renamed default component from `Icon` to `SvgIcon`

### Added
- ✨ New `index.js` barrel export in output directory
- 🧪 67 new unit tests (1285 total)
- 📚 Improved JSDoc documentation

### Fixed
- 🐛 Fixed regex for Windows path normalization
- 🔧 Improved error typing (removed `any`)

### Internal
- 🏗️ Centralized constants in `constants.ts`
- 📦 Added barrel exports for services and utils
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- Initial development version

## [0.1.1] - 2026-01-05

- 🎨 **Color Variants**: Create color variations of icons
- 📦 **Sprite Generation**: Generate SVG sprites from selected icons
- 🎯 **Code Actions**: Quick actions to transform SVGs in your code
- 💡 **IntelliSense**: Autocomplete and hover previews for icon references

### Technical
- TypeScript with strict mode
- ESLint + Prettier configuration
- Jest testing framework with 994+ tests
- VS Code Extension API 1.85+

[Unreleased]: https://github.com/user/MasterSVG-icon-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/user/MasterSVG-icon-studio/releases/tag/v0.1.0
