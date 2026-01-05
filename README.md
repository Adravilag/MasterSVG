# MasterSVG Icon Studio

<p align="center">
  <img src="resources/icon.svg" alt="MasterSVG Icon Studio" width="128" height="128">
</p>

<p align="center">
  <strong>Professional SVG icon management studio for VS Code</strong><br>
  Preview, edit, transform and build icon components for your design system.
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=MasterSVG.mastersvg-icon-studio"><img src="https://img.shields.io/badge/version-0.1.0-blue" alt="Version"></a>
  <img src="https://img.shields.io/badge/VS%20Code-1.85%2B-purple" alt="VS Code">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/tests-1165%20passing-brightgreen" alt="Tests">
</p>

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 📁 **SVG Browser** | Browse, search and organize all SVG files in your workspace |
| 🎨 **Visual Editor** | Edit colors, apply variants, add animations with live preview |
| ⚡ **Icon Builder** | Generate `icons.js`, `sprite.svg` and Web Components |
| 🔍 **IntelliSense** | Autocomplete, hover previews for icons |
| 📦 **Component Export** | Export to React, Vue, Svelte, Angular, Solid, Qwik, Preact |
| 🌐 **Iconify Integration** | Access 200,000+ open source icons |
| 🎭 **31 Animations** | Spin, pulse, bounce, shake, fade, heartbeat, wobble and more |
| 📝 **License Management** | Auto-generate attribution files for icon collections |

---

## 📁 SVG File Browser

Dedicated sidebar panel with four views in the Activity Bar:

| View | Description |
|------|-------------|
| **SVG Files** | All `.svg` files in your workspace organized by folder |
| **Code** | Inline SVGs, `<img>` tags, and `<svg-icon>` usages detected |
| **Built Icons** | Your generated `icons.js` or `sprite.svg` collection |
| **Preview** | Live preview webview panel for selected icons |

### File Detection
- Automatic workspace scanning on startup
- Configurable SVG folders
- `.msignore` file support with syntax highlighting
- Exclude patterns for `node_modules`, `dist`, etc.

---

## 🎨 Visual Icon Editor

Full-featured icon editor panel with:

### Color Management
- Extract and display all colors from SVG
- Live color preview and replacement
- Convert colors to `currentColor` for theming
- Add fill/stroke colors to paths
- SMIL animation color detection

### Variants System
- Create light/dark theme variants
- Auto-generate variants (invert, darken, lighten, muted, grayscale)
- Set default variant per icon

### Animation Support
31 built-in CSS animations organized by category:

| Category | Animations |
|----------|------------|
| **Basic** | spin, spin-reverse, pulse, pulse-grow, bounce, bounce-horizontal, shake, shake-vertical, fade, float, blink, glow |
| **Attention** | swing, wobble, rubber-band, jello, heartbeat, tada |
| **Entrance/Exit** | fade-in, fade-out, zoom-in, zoom-out, slide-in-up, slide-in-down, slide-in-left, slide-in-right, flip, flip-x |
| **Draw** | draw, draw-reverse, draw-loop |

---

## ⚡ Icon System Builder

Generate a complete icon system with one command:

```
mastersvg-icons/
├── icons.js          # Icon definitions with optional animation config
├── icons.d.ts        # TypeScript type definitions
├── sprite.svg        # SVG sprite sheet with symbols
├── icon.js           # Custom Web Component
└── variants.js       # Color variant definitions (optional)
```

### Build Formats
- **icons.js** — JavaScript module with icon definitions (`icons.js` + `icons.d.ts`)
- **sprite.svg** — SVG sprite with `<symbol>` elements

### Output Includes
- TypeScript type definitions for icon names
- Variant color mappings

---

## 🔍 IntelliSense Features

### Autocomplete
- Icon names in `<svg-icon name="...">` and `<Icon name="...">`
- Variant names in `variant="..."`
- Animation names in `animation="..."`
- Icon component attributes (`name`, `size`, `color`, `variant`, `animation`)

### Hover Previews
- See icon preview on hover over icon names
- View icon metadata and source path

### Code Actions
- Convert inline `<svg>` to icon component
- Transform `<img>` tags to icon components

### Diagnostics
- Suggest converting `<img src="*.svg">` to icon components
- Quick fixes to transform or search icons

---

## 📦 Component Export

Export icons as production-ready components for 9 frameworks:

| Framework | TypeScript | Features |
|-----------|------------|----------|
| **React** | ✅ | memo, forwardRef, props spread |
| **React Native** | ✅ | react-native-svg components |
| **Vue 3** | ✅ | Composition API, script setup |
| **Vue SFC** | ✅ | Single File Component, defineProps |
| **Svelte** | ✅ | Reactive props, $$restProps |
| **Angular** | ✅ | @Input decorators, standalone |
| **SolidJS** | ✅ | splitProps, mergeProps |
| **Qwik** | ✅ | component$ |
| **Preact** | ✅ | Functional component |

> **Nota:** La configuración `masterSVG.outputFormat` ofrece transformación rápida a 5 formatos (jsx, vue, svelte, astro, html). Para exportación completa con opciones avanzadas, usa el comando "Export Component".

### Export Options
- Default size and color
- Named or default export
- TypeScript or JavaScript
- Customizable component name

---

## 🌐 Iconify Integration

Access the entire Iconify ecosystem:

- **200,000+** icons from **150+** collections
- Search icons by name, collection or keyword
- Preview icons before importing
- Download and add to your collection
- Automatic license attribution

### Supported Collections
Access all Iconify collections including Material Design, Lucide, Heroicons, Tabler, Phosphor, Remix Icon, Carbon, Fluent UI, Bootstrap Icons, Font Awesome, and many more.

---

## 🎯 Commands Reference

### Panel & Navigation

| Command | Shortcut | Description |
|---------|----------|-------------|
| Open Panel | `Ctrl+Shift+I` / `Cmd+Shift+I` | Open the Icon Studio sidebar |
| Insert Icon | `Ctrl+Alt+I` / `Cmd+Alt+I` | Quick insert icon at cursor |
| Search Icons | — | Search and import from Iconify |
| Open Welcome | — | Show getting started panel |

### Building

| Command | Description |
|---------|-------------|
| Build Icons | Generate `icons.js` + `sprite.svg` |
| Build All Files | Build all workspace SVG files |
| Build All References | Build inline SVGs and references |
| Build Single Icon | Build one icon to collection |
| Generate Sprite | Generate SVG sprite only |
| Clean Sprite | Remove icons from sprite |

### Editing

| Command | Description |
|---------|-------------|
| Color Editor | Visual color editor panel |
| Show Details | View icon metadata |
| Transform SVG | Convert to icon component |
| Rename Icon | Rename icon in collection |
| Export Component | Export as framework component |

### Tree View Actions

| Command | Description |
|---------|-------------|
| Add to Collection | Add SVG file to built icons |
| Remove from Built | Remove from collection |
| Go to Code | Jump to icon definition |
| Copy Icon Name | Copy icon identifier |
| Delete Icons | Delete selected icons |
| Find and Replace | Replace icon references |
| Import Missing | Import missing icon from Iconify |

### License Management

| Command | Description |
|---------|-------------|
| Generate Licenses | Create license attribution files |
| Show License Summary | Display license overview |

---

## ⚙️ Configuration

All settings under the `masterSVG.*` namespace:

### Component Settings
```json
{
  "masterSVG.componentName": "svg-icon",
  "masterSVG.componentImport": "@/components/ui/Icon",
  "masterSVG.webComponentName": "svg-icon",
  "masterSVG.iconNameAttribute": "name"
}
```

### Folder Settings
```json
{
  "masterSVG.svgFolders": [
    "svgs", "src/assets/icons", "src/icons", 
    "public/icons", "assets/icons", "icons",
    "svg", "assets/svg"
  ],
  "masterSVG.outputDirectory": "",
  "masterSVG.excludePatterns": [
    "**/node_modules/**", "**/dist/**",
    "**/build/**", "**/.git/**"
  ]
}
```

### Output Settings
```json
{
  "masterSVG.outputFormat": "jsx",
  "masterSVG.buildFormat": "icons.js",
  "masterSVG.namingConvention": "kebab-case"
}
```

**Build formats:** `icons.js` (JavaScript module), `sprite.svg` (SVG sprite)

**Available naming conventions:** `kebab-case`, `camelCase`, `PascalCase`, `snake_case`

### Behavior Settings
```json
{
  "masterSVG.autoImport": true,
  "masterSVG.scanOnStartup": true,
  "masterSVG.showUsagesInTree": true,
  "masterSVG.deleteAfterBuild": false
}
```

### Preview Settings
```json
{
  "masterSVG.previewBackground": "checkered",
  "masterSVG.defaultIconSize": 24,
  "masterSVG.defaultAnimation": "none"
}
```

**Background options:** `transparent`, `light`, `dark`, `checkered`

### License Settings
```json
{
  "masterSVG.licenseFormat": "combined",
  "masterSVG.autoGenerateLicenses": false,
  "masterSVG.licensesFolder": "icon-licenses"
}
```

**License formats:** `combined`, `perCollection`, `both`

### Language Settings
```json
{
  "masterSVG.language": "auto"
}
```

**Available languages:** `auto`, `en`, `es`, `zh`, `ru`

### Astro Library Settings (Optional)
```json
{
  "masterSVG.useAstroLibrary": true,
  "masterSVG.astroLibraryPath": "",
  "masterSVG.astroLibraryPort": 4568
}
```

---

## 📄 Ignore File (.msignore)

Create a `.msignore` file in your workspace root to exclude files/folders from scanning:

```bash
# Exclude folders
backup/
temp/
deprecated/

# Exclude specific files
icons/old-logo.svg

# Exclude patterns
**/old-*
**/*.backup.svg
**/*-draft.svg
```

The extension provides syntax highlighting and language support for `.msignore` files.

---

## 🧩 Web Component

When you build icons, MasterSVG generates an `icon.js` Web Component:

```html
<!-- Basic usage -->
<svg-icon name="star"></svg-icon>

<!-- With size (pixels) -->
<svg-icon name="arrow" size="32"></svg-icon>

<!-- With color -->
<svg-icon name="heart" color="#e91e63"></svg-icon>

<!-- With animation -->
<svg-icon name="spinner" animation="spin"></svg-icon>

<!-- With variant -->
<svg-icon name="theme" variant="dark"></svg-icon>

<!-- With light/dark mode colors -->
<svg-icon name="logo" light-color="#333" dark-color="#fff"></svg-icon>

<!-- Combined -->
<svg-icon name="notification" size="24" color="currentColor" animation="pulse" variant="light"></svg-icon>
```

### Web Component Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | string | — | Icon identifier (required) |
| `size` | number | 24 | Icon size in pixels |
| `color` | string | currentColor | Icon color |
| `variant` | string | — | Color variant name |
| `animation` | string | none | Animation name |
| `light-color` | string | — | Color for light mode |
| `dark-color` | string | — | Color for dark mode |

---

## 🌍 Internationalization

MasterSVG supports 4 languages:

| Language | Code | Flag |
|----------|------|------|
| English | `en` | 🇬🇧 |
| Español | `es` | 🇪🇸 |
| 中文 | `zh` | 🇨🇳 |
| Русский | `ru` | 🇷🇺 |

Set via `masterSVG.language` or auto-detect from VS Code locale.

---

## 🚀 Getting Started

1. **Install** the extension from VS Code Marketplace
2. **Open** a project with SVG files
3. **Click** the Icon Studio icon in the Activity Bar
4. **Configure** your output directory in the Welcome panel
5. **Start building** your icon system!

### Quick Start Commands
- `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Shift+I` (Mac) — Open Icon Studio panel
- `Ctrl+Alt+I` (Windows/Linux) / `Cmd+Alt+I` (Mac) — Quick insert icon

---

## 💻 Development

```bash
# Clone the repository
git clone https://github.com/adravilag/MasterSVG.git
cd MasterSVG

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run tests (1165 tests)
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Format code
npm run format

# Package extension
npm run package
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile TypeScript to JavaScript |
| `npm run watch` | Watch mode with auto-compile |
| `npm run watch:esbuild` | Fast esbuild watch mode |
| `npm test` | Run Jest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Format with Prettier |
| `npm run package` | Create VSIX package |

### Project Structure

```
src/
├── extension.ts        # Extension entry point
├── commands/           # Command handlers (16 modules)
├── handlers/           # Message handlers for webviews
├── panels/             # Webview panels (Editor, Details, Welcome)
├── providers/          # Tree providers, completion, hover
├── services/           # Business logic (20 services)
├── templates/          # HTML/CSS templates
├── types/              # TypeScript type definitions
├── utils/              # Helper utilities
└── i18n/               # Localization files
```

### Tech Stack

- **TypeScript** with strict mode
- **VS Code Extension API** 1.85+
- **Jest** for testing (1165+ tests)
- **ESLint** + **Prettier** for code quality
- **esbuild** for bundling

---

## 📋 Requirements

- VS Code 1.85.0 or higher
- Node.js (for development)

---

## 🐛 Known Issues

Report issues on [GitHub Issues](https://github.com/adravilag/MasterSVG/issues).

---

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT © [Adrián Dávila Guerra](https://adravilag.github.io/MasterSVG/)

---

<p align="center">
  Made with ❤️ for the VS Code community
</p>

