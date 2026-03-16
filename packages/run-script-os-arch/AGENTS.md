# AGENTS.md

## Dispatch Logic Agent

### Architecture

The dispatcher is split across three files:

- **`types.ts`** — Type definitions and custom error classes.
- **`dispatch.ts`** — Core dispatch logic with all functionality.
- **`index.ts`** — Public API re-exports.

### Type System

#### Input Parameters (n-params Pattern)

```ts
import { ResolveScriptParams, DispatcherOptions } from './types.js';

const resolveScript = (params: ResolveScriptParams): ResolveScriptResult => {
  const { base, platform, arch, scripts } = params;
  // ...
};
```

#### Return Types

Dedicated types for function outputs improve clarity:

```ts
type ResolveScriptResult = {
  key: string | null;
  command: string | null;
  tried: string[];
  skipped?: boolean;
};
```

#### Error Types

Strongly-typed custom error classes for structured error handling:

- `DispatcherError` — Base error class.
- `PackageJsonError` — File read/parse failures.
- `ScriptNotFoundError` — No matching script found with diagnostics.
- `LifecycleEventError` — Missing npm_lifecycle_event.

### Function Guidelines

#### Guidelines

- Use **const arrow functions** for consistency.
- For **>2 parameters**, use n-params (single object parameter).
- Set **return types explicitly**.
- Use **JSDoc/TSDoc comments** for all public functions.
- Access environment variables with **bracket notation** (`process.env['VAR']`).

#### Example: `dispatch` Function

```ts
/**
 * Main dispatch function. Orchestrates the entire flow.
 * @param options - Optional configuration flags.
 * @throws {PackageJsonError} If package.json cannot be found or parsed.
 * @throws {LifecycleEventError} If npm_lifecycle_event is not set.
 * @throws {ScriptNotFoundError} If no matching script is found and not optional.
 */
const dispatch = (options: DispatcherOptions = {}): void => {
  try {
    // ... implementation
  } catch (err) {
    // ... error handling
  }
};
```

### Core Functions

| Function | Parameters | Returns | Purpose |
|----------|-----------|---------|---------|
| `findPackageJson` | `startDir: string` | `string \| null` | Walk up directory tree to find package.json |
| `readScripts` | `pkgPath: string` | `Record<string, string>` | Parse scripts from package.json with error handling |
| `resolveScript` | `params: ResolveScriptParams` | `ResolveScriptResult` | Resolve correct script using fallback chain |
| `dispatch` | `options?: DispatcherOptions` | `void` | Main orchestrator with try-catch and CLI entry |

### CLI Flags

- `--verbose` — Enable verbose output (also `RSOA_DEBUG=1`)
- `--dry-run` — Show what would run without executing (also `RSOA_DRY_RUN=1`)
- `--optional` — Exit 0 silently if no match found
- `--required` — Exit 1 if no match found (overrides lifecycle hooks)
- `--cwd <path>` — Override working directory for package.json lookup

### Resolution Chain

1. `<base>:<platform>:<arch>` — Exact match
2. `<base>:<platform>` — OS-only match
3. `<base>:<arch>` — Architecture-only match
4. `<base>:default` — Default match
5. Self-reference skip — If base script equals `run-script-os-arch`, skip silently
6. Error or exit 0 with `--optional`

### Documentation Standards

- **TSDoc/JSDoc** for all functions with `@param`, `@returns`, `@throws`.
- **Inline comments** for complex logic sections.
- **Error messages** are user-friendly and diagnostic.

### Testing Considerations

- Stub `os.platform()` and `os.arch()` for deterministic tests.
- Mock filesystem for package.json scenarios.
- Test all fallback chain levels.
- Test lifecycle hook self-reference skip.
- Test CLI flag parsing.

---

*Last updated: March 16, 2026*
