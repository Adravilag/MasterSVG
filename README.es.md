````markdown


## 🛠️ Desarrollo (para contribuyentes)

Si quieres trabajar en la extensión localmente, sigue estos pasos:

1. Instala dependencias:

```bash
npm ci
```

2. Compila el proyecto (TypeScript → `out`/`dist`):

```bash
npm run compile
```

3. Desarrollo rápido — reconstrucción con esbuild en modo watch:

```bash
npm run watch:esbuild
```

4. Ejecuta el conjunto de tests unitarios:

```bash
npm test
```

5. Lint y formato:

```bash
npm run lint
npm run format
```

6. Empaquetar la extensión (.vsix):

```bash
npm run package
```

7. Instalar localmente la `.vsix` (opcional):

```bash
code --install-extension mastersvg-icon-studio-*.vsix
```

Consejos rápidos:
- Para iterar sobre la extensión en VS Code, usa la configuración de depuración "Run Extension" (F5).
- Usa `npm run watch:esbuild` mientras desarrollas para ver los cambios en caliente en la sesión de depuración.

4. **Configure** your output directory in the Welcome panel
5. **Start building** your icon system!

### Quick Start Commands
- `Ctrl+Shift+I` (Windows/Linux) / `Cmd+Shift+I` (Mac) — Open Master SVG panel
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

## Capturas

Reemplaza estas imágenes con capturas reales dentro de `resources/screenshots/`:

![Captura 1](resources/screenshots/screenshot-1.svg)
![Captura 2](resources/screenshots/screenshot-2.svg)

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT © [Adrián Dávila Guerra](https://adravilag.github.io/MasterSVG/)

````
