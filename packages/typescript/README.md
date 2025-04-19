# Shared TypeScript Configuration

This package contains shared TypeScript configurations that can be extended by other packages in the monorepo.

## Usage

To use the base configuration in your package, extend it in your `tsconfig.json`:

```json
{
  "extends": "../typescript/tsconfig.base.json",
  "compilerOptions": {
    // Package-specific options here
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

## Base Configuration Features

The base configuration includes:

- ES2020 target and module system
- Strict type checking enabled
- Source maps and declaration files
- Common best practices for TypeScript
- Decorator support
- Sensible defaults for Node.js development

## Customizing

Each package can override any of the base settings by specifying them in their local `tsconfig.json`.
