# Contributing to MasterSVG Icon Studio

Thank you for your interest in contributing to MasterSVG Icon Studio! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)

## Code of Conduct

Please be respectful and constructive in all interactions. We welcome contributors of all experience levels.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/MasterSVG-icon-studio.git`
3. Add upstream remote: `git remote add upstream https://github.com/adravilag/MasterSVG-icon-studio.git`

## Development Setup

### Prerequisites

- Node.js >= 18.x
- npm >= 9.x
- VS Code >= 1.85.0

### Installation

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile

# Run tests
npm test
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. The extension will be available in the new VS Code window

## Project Structure

```
src/
├── extension.ts        # Entry point
├── commands/           # Command handlers
├── providers/          # Tree views and providers
├── services/           # Business logic
├── panels/             # Webview panels
├── handlers/           # Message handlers
├── utils/              # Helper functions
├── types/              # TypeScript definitions
├── templates/          # HTML/CSS/JS templates
├── i18n/               # Internationalization
└── test/               # Test files
```

## Making Changes

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(editor): add animation preview support
fix(sprite): resolve duplicate icon issue
docs(readme): update installation instructions
```

## Testing

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests (requires VS Code)
npm run test:e2e
```

### Writing Tests

- Place tests in `src/test/` mirroring the source structure
- Use Jest with the AAA pattern (Arrange, Act, Assert)
- Name test files with `.test.ts` suffix
- Aim for 80% code coverage

Example:
```typescript
describe('MyService', () => {
  describe('myMethod', () => {
    it('should return expected result when given valid input', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = myMethod(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

## Submitting Changes

### Pull Request Process

1. Update your fork with the latest upstream changes
2. Create a feature branch from `main`
3. Make your changes with clear commits
4. Ensure all tests pass: `npm test`
5. Run linting: `npm run lint`
6. Format code: `npm run format`
7. Push to your fork and create a Pull Request

### Pull Request Checklist

- [ ] Code follows the style guide
- [ ] Tests added/updated for changes
- [ ] All tests pass
- [ ] No linting errors
- [ ] Documentation updated if needed
- [ ] CHANGELOG.md updated for notable changes

## Style Guide

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `npm run format`)
- **Linting**: ESLint (run `npm run lint`)

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Variables | camelCase | `iconName` |
| Functions | camelCase | `getIconById` |
| Classes | PascalCase | `IconService` |
| Files (classes) | PascalCase | `IconService.ts` |
| Files (utils) | camelCase | `configHelper.ts` |
| Constants | camelCase | `defaultConfig` |
| Folders | kebab-case | `icon-editor` |

### Best Practices

- Keep functions under 50 lines
- Maximum 4 parameters per function
- Avoid deep nesting (max 4 levels)
- Use meaningful variable names
- Document complex logic with comments
- Prefer `const` over `let`
- Avoid `any` type when possible

## Questions?

Feel free to open an issue for questions or discussions. We're happy to help!

---

Thank you for contributing! 🎉
