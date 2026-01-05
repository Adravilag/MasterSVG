# MasterSVG Icon Studio for VS Code

> **The complete SVG icon workflow without leaving your editor**

Search, preview, edit, optimize, and export SVG icons to React, Vue, Svelte, Angular and more — all from VS Code.

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![VS Code](https://img.shields.io/badge/VS%20Code-1.85%2B-purple)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Why MasterSVG Icon Studio?

Most icon extensions do **one thing**. MasterSVG Icon Studio does the **complete workflow**:

```
🔍 Search    →    👁️ Preview    →    🎨 Edit    →    ⚡ Optimize    →    📦 Export
   Iconify         Live zoom         Colors          SVGO              7 frameworks
   Workspace       Dark/light        Variants        3 presets         Web Component
```

**No more switching between 5 different tools.**

---

## 🎬 Quick Demo

<!-- TODO: Add GIF demos -->

| Search & Browse | Edit Colors | Export Component |
|-----------------|-------------|------------------|
| ![Search](https://via.placeholder.com/280x180?text=Search+Demo) | ![Edit](https://via.placeholder.com/280x180?text=Color+Editor) | ![Export](https://via.placeholder.com/280x180?text=Export+Demo) |

---

## 🚀 Features

### 🔍 Unified Icon Browser
- **Workspace SVGs**: Auto-scan your project folders
- **Iconify**: Search 200,000+ open source icons
- **Library**: Your personal icon collection
- **One panel**, all sources

### 🎨 Visual Color Editor
- Detect all colors in any SVG
- Click to edit with color picker
- Preset palettes for quick changes
- **NEW**: Auto light/dark mode with CSS `light-dark()`

### ⚡ SVGO Optimization
- 3 presets: Minimal, Safe, Aggressive
- See file size reduction in real-time
- Apply, copy, or preview before saving

### 📦 Multi-Framework Export
Generate production-ready components for:
- React / React Native
- Vue 3 (Composition API)
- Svelte
- Angular
- SolidJS
- Qwik
- Preact
- **Web Component** (vanilla JS)

### 🎯 Icon System Builder
Build a complete icon system with one command:
- `icons.js` — Icon definitions
- `sprite.svg` — SVG sprite sheet
- `icon.js` — Custom Web Component
- `variants.js` — Color themes
- `animations.js` — Pre-built animations

### 💡 IntelliSense Integration
- **Autocomplete**: `<Icon name="` → suggestions appear
- **Hover preview**: See the icon without leaving your code
- **Go to definition**: Jump to SVG source

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `Icon Studio: Open Panel` | Browse all icons |
| `Icon Studio: Search Icons` | Search Iconify |
| `Icon Studio: Build Icons` | Generate icons.js + sprite |
| `Icon Studio: Color Editor` | Edit SVG colors |
| `Icon Studio: Optimize SVG` | SVGO optimization |
| `Icon Studio: Transform SVG` | Convert to component |

**Shortcuts:**
- `Ctrl+Shift+I` — Open panel
- `Ctrl+Alt+I` — Insert icon at cursor

---

## ⚙️ Configuration

```json
{
  // Your Icon component name
  "masterSVG.componentName": "Icon",
  
  // Import path for auto-imports
  "masterSVG.componentImport": "@/components/ui/Icon",
  
  // Folders to scan for SVGs
  "masterSVG.svgFolders": [
    "src/assets/icons",
    "src/icons",
    "public/icons"
  ],
  
  // Output format: jsx, vue, svelte, html, angular
  "masterSVG.outputFormat": "jsx",
  
  // Output directory for generated files
  "masterSVG.outputDirectory": "src/icons",
  
  // Auto-add imports when inserting icons
  "masterSVG.autoImport": true
}
```

---

## 🎨 Generated Web Component

The built-in Web Component supports modern CSS features:

```html
<!-- Basic usage -->
<my-icon name="star"></my-icon>

<!-- With size and color -->
<my-icon name="star" size="24" color="#1a73e8"></my-icon>

<!-- Auto dark mode (just set one color!) -->
<my-icon name="star" color="#333"></my-icon>

<!-- Explicit light/dark -->
<my-icon name="star" light-color="#333" dark-color="#fff"></my-icon>

<!-- With animation -->
<my-icon name="loader" animation="spin"></my-icon>
```

**Available animations:** `spin`, `pulse`, `bounce`, `shake`, `fade`, `float`, `wiggle`, `heartbeat`

---

## 🔧 Workflow Examples

### Import an icon from Iconify
1. Open Icon Studio panel (`Ctrl+Shift+I`)
2. Search for "arrow right"
3. Click the icon to add to your library
4. Click again to insert in your code

### Edit colors of an SVG
1. Right-click any SVG file → "Icon Studio: Color Editor"
2. Click any color swatch to change it
3. Use presets or pick custom colors
4. Save when done

### Build your icon system
1. Add icons to your workspace folder
2. Run "Icon Studio: Build Icons"
3. Get `icons.js`, `sprite.svg`, and `icon.js` ready to use

---

## 📊 Comparison

| Feature | Icon Studio | jock.svg | svg-preview | Iconbuddy |
|---------|--------------|----------|-------------|-----------|
| Workspace scan | ✅ | ❌ | ❌ | ❌ |
| Iconify search | ✅ | ❌ | ❌ | ✅ |
| Color editor | ✅ | ❌ | ❌ | ❌ |
| SVGO optimize | ✅ | ✅ | ❌ | ❌ |
| React/Vue/Svelte export | ✅ | ❌ | ❌ | ⚠️ |
| Web Component | ✅ | ❌ | ❌ | ❌ |
| Sprite generation | ✅ | ❌ | ❌ | ❌ |
| IntelliSense | ✅ | ❌ | ❌ | ❌ |
| Animations | ✅ | ❌ | ❌ | ❌ |

---

## 🛠️ Development

```bash
git clone https://github.com/MasterSVG/icon-manager-vscode
cd icon-manager-vscode
npm install
npm run compile
# Press F5 to launch extension in debug mode
```

**Tests:**
```bash
npm test
# 1444 tests, 33 suites
```

---

## 📝 Changelog

### 0.1.0 (Coming Soon)
- Initial release
- Workspace SVG scanning
- Iconify integration
- Color editor with live preview
- SVGO optimization (3 presets)
- Export to 8 frameworks
- Icon system builder
- Web Component with animations
- CSS `light-dark()` support
- IntelliSense (autocomplete + hover)

---

## 📄 License

MIT © [MasterSVG](https://github.coMasterSVGrsvg)

---

<p align="center">
  <b>Stop switching tools. Manage all your icons in VS Code.</b>
</p>
