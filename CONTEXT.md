# target-run

**OS & Architecture-Aware npm Script Dispatcher**

| | |
|---|---|
| **Package** | `target-run` |
| **Category** | CLI Utility / Build Tooling |
| **Runtime** | Node.js >= 16.0.0 |
| **Version** | 1.0.0 |
| **License** | MIT |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [Usage Specification](#3-usage-specification)
4. [Architecture & Technical Design](#4-architecture--technical-design)
5. [Implementation Plan](#5-implementation-plan)
6. [Edge Cases & Error Handling](#6-edge-cases--error-handling)
7. [Testing Strategy](#7-testing-strategy)
8. [API & CLI Reference](#8-api--cli-reference)
9. [Package Configuration](#9-package-configuration)
10. [Compatibility Matrix](#10-compatibility-matrix)
11. [Security Considerations](#11-security-considerations)
12. [Open Questions & Future Work](#12-open-questions--future-work)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

`target-run` is a lightweight Node.js CLI tool designed to solve a fundamental problem in cross-platform development: running different npm scripts depending on the operating system and CPU architecture of the host machine.

When a developer runs `npm test` (or any configured script), the tool detects the current platform (e.g. `win32`, `darwin`, `linux`) and architecture (e.g. `x64`, `arm64`) at runtime, then dispatches to the matching sub-script defined in `package.json`. This eliminates ad-hoc shell conditionals, platform-specific CI hacks, and the overhead of maintaining separate configuration files per environment.

The tool is inspired by packages like `run-script-os` but extends the concept to include CPU architecture as a first-class routing dimension — critical in a world where Apple Silicon (`arm64`), Windows on ARM, and diverse Linux targets must be differentiated.

### Problem Statement

- Teams developing native Node addons, Electron apps, CLI tools, or containerized services often need to run platform-specific test suites, build commands, or environment setups.
- Existing solutions either ignore architecture entirely, require verbose shell scripting, or break portability across Windows/macOS/Linux.
- This tool provides a zero-dependency, convention-based dispatcher that integrates seamlessly with the standard `npm scripts` workflow.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Dispatch the correct npm script based on `os.platform()` and `os.arch()` at runtime.
- Follow a strict, predictable naming convention: `<script>:<platform>:<arch>`.
- Support partial matching — fall back gracefully when a full match doesn't exist.
- Provide a clear error message when no matching script is found.
- Work with npm, yarn, pnpm, and bun without modifications.
- Have zero runtime production dependencies (only Node.js built-ins).
- Be installable globally or as a `devDependency`.
- Support dry-run mode for debugging which script would be selected.

### 2.2 Non-Goals

- Does not replace `cross-env` or `cross-env-shell` — those handle environment variable syntax, not script dispatch.
- Does not support arbitrary condition matching beyond platform and architecture.
- Does not parse or modify shell commands — delegates entirely to the package manager.
- Does not manage secrets, environment files, or CI configuration.
- Does not support Windows `.bat` or `.cmd`-specific syntax quirks directly.

---

## 3. Usage Specification

### 3.1 Script Naming Convention

All platform-specific scripts follow this pattern in `package.json`:

```
<base-script>:<platform>:<arch>
```

Where:

- **`<base-script>`** is the name of the npm script that invokes `target-run` (e.g. `test`, `build`, `start`).
- **`<platform>`** is the value of `os.platform()` — one of: `win32`, `darwin`, `linux`, `freebsd`, `openbsd`, `sunos`, `aix`.
- **`<arch>`** is the value of `os.arch()` — one of: `x64`, `arm64`, `ia32`, `arm`, `mips`, `mipsel`, `ppc64`, `s390x`.

### 3.2 Example package.json

```json
{
  "scripts": {
    "test": "target-run",
    "test:win32:x64":    "cross-env-shell TEST_ENV=win32-x64 jest --config=jest.e2e.config.ts",
    "test:darwin:arm64": "cross-env-shell TEST_ENV=darwin-arm64 jest --config=jest.e2e.config.ts",
    "test:linux:x64":    "cross-env-shell TEST_ENV=linux-x64 jest --config=jest.e2e.config.ts"
  }
}
```

When the developer runs `npm test` on a Linux x64 machine, the dispatcher:

1. Reads `process.env.npm_lifecycle_event` to determine the calling script name (`test`).
2. Calls `os.platform()` → `linux` and `os.arch()` → `x64`.
3. Constructs the target key: `test:linux:x64`.
4. Finds the matching script in `package.json` and runs it via the package manager.

### 3.3 Fallback Resolution Order

If an exact match is not found, the dispatcher uses the following resolution chain:

| Priority | Pattern Tried | Example | Behaviour |
|----------|---------------|---------|-----------|
| 1 — exact | `<script>:<platform>:<arch>` | `test:linux:x64` | Run it |
| 2 — OS only | `<script>:<platform>` | `test:linux` | Run it |
| 3 — arch only | `<script>:<arch>` | `test:x64` | Run it |
| 4 — default | `<script>:default` | `test:default` | Run it |
| 5 — self | `<script>` value is `target-run` | `pretest` | Skip silently, exit 0 |
| 6 — error | No match at any level | — | Exit code 1 (or exit 0 with `--optional`) |

Level 5 exists specifically for lifecycle hooks (`pretest`, `posttest`, etc.) — if a pre/post script is defined as `target-run` but no platform variant exists for the current environment, the tool exits cleanly rather than erroring or looping. Level 6 can be suppressed with the `--optional` flag for cases where a missing platform script should be a no-op rather than a failure.

This ensures backward compatibility and progressive specificity.

### 3.4 Lifecycle Hook Support

`npm_lifecycle_event` is set correctly for pre/post hooks by all package managers, so dispatching works automatically across the full lifecycle. Define `target-run` as the handler for each hook, then add only the platform variants you need:

```json
{
  "scripts": {
    "pretest":  "target-run",
    "test":     "target-run",
    "posttest": "target-run",

    "pretest:linux:x64":     "...",
    "pretest:darwin:arm64":  "...",

    "test:linux:x64":        "...",
    "test:darwin:arm64":     "...",

    "posttest:linux:x64":    "...",
    "posttest:darwin:arm64": "..."
  }
}
```

Pre/post hooks do not need a platform variant on every target — the level 5 fallback means hooks with no matching variant are silently skipped. Use `--required` on hooks where a missing variant should be treated as a hard failure.

---

## 4. Architecture & Technical Design

### 4.1 Package Structure

```
target-run/
  bin/
    target-run.js    ← CLI entry point (#!/usr/bin/env node)
  src/
    index.js                 ← Core dispatch logic
    resolver.js              ← Script name resolution & fallback
    runner.js                ← Spawns the package manager subprocess
    detect.js                ← OS/arch detection wrappers
    errors.js                ← Typed error classes
  test/
    resolver.test.js
    runner.test.js
    detect.test.js
  package.json
  README.md
```

### 4.2 Core Modules

#### `bin/target-run.js`

The shebang entry point. Minimal: reads CLI flags (`--dry-run`, `--verbose`, `--help`) and delegates to `src/index.js`. Handles top-level unhandled rejections and exits with the appropriate code.

#### `src/detect.js`

Wraps `os.platform()` and `os.arch()` for testability using a factory pattern. Rather than exporting bare functions that call `os` directly (which can't be intercepted without module mocking), the module exports a `createDetector(os_module)` factory. Production code imports the default export, which is `createDetector(os)`. Tests call the factory with a plain stub object:

```js
// src/detect.js
import os from 'os';

export function createDetector(os_module) {
  return {
    getPlatform: () => os_module.platform(),
    getArch:     () => os_module.arch(),
  };
}

export default createDetector(os);
```

```js
// test
import { createDetector } from '../src/detect.js';

const detector = createDetector({ platform: () => 'win32', arch: () => 'x64' });
```

This approach is framework-agnostic (no `jest.mock` required), produces no global mutations, and keeps each test fully isolated. `resolver.js` and `index.js` accept a `detector` parameter so the same stub can be threaded through without touching module internals.

#### `src/resolver.js`

Responsible for finding the correct script key in the scripts map. Algorithm:

1. Accept the base script name, platform, arch, the full scripts object, and an `optional` flag.
2. Iterate through the resolution order defined in Section 3.3 (levels 1–4).
3. Return the first matched `{ key, command }` pair.
4. If no match is found, check level 5: if the base script's own value is `target-run`, return `{ key: null, command: null, skipped: true }` to signal a silent no-op.
5. Otherwise throw `ScriptNotFoundError`, unless `optional` is true in which case return `skipped: true`.

This module is pure (no side effects) and fully unit-testable.

#### `src/runner.js`

Spawns a child process using the detected package manager. Detection priority:

1. Check for `npm_execpath` in environment (set by npm/yarn/pnpm/bun automatically).
2. Parse the path to determine the package manager name.
3. Fall back to `npm` if not determinable.

Uses `child_process.spawnSync` with `{ stdio: 'inherit', shell: false }` to preserve TTY behavior, colored output, and process signals. Forwards all original arguments after `--` to the spawned script.

#### `src/errors.js`

Defines typed error classes for structured error handling:

```js
class ScriptNotFoundError extends Error { ... }
class PackageJsonReadError extends Error { ... }
class ChildProcessError extends Error { ... }
```

### 4.3 Data Flow

```
npm run test
  ↓
bin/target-run.js  (parse flags)
  ↓
src/index.js
  ├─ read package.json (find scripts map)
  ├─ detect.getPlatform() → 'linux'
  ├─ detect.getArch()     → 'x64'
  ├─ resolver.resolve('test', 'linux', 'x64', scripts)
  │    └─ returns { key: 'test:linux:x64', command: 'cross-env-shell ...' }
  └─ runner.run(packageManager, 'test:linux:x64')
       └─ spawnSync('npm', ['run', 'test:linux:x64'])
```

---

## 5. Implementation Plan

### 5.1 Phases & Timeline

| Phase | Timeline | Deliverable | Details |
|-------|----------|-------------|---------|
| 1 | Week 1 | Scaffolding | Package setup, bin entry, `detect.js`, basic CLI flags (`--help`, `--version`) |
| 2 | Week 1 | Core Logic | `resolver.js` with full fallback chain, `errors.js`, `index.js` wiring |
| 3 | Week 2 | Process Runner | `runner.js` with package manager detection, `spawnSync`, signal forwarding |
| 4 | Week 2 | Unit Tests | 100% coverage on `resolver.js` and `detect.js`, 80%+ overall |
| 5 | Week 3 | Integration Tests | Real npm script execution on simulated `package.json` fixtures |
| 6 | Week 3 | Edge Cases | Missing scripts, malformed `package.json`, monorepo root detection |
| 7 | Week 4 | Documentation | README, JSDoc, changelog, contribution guide |
| 8 | Week 4 | Release | npm publish, GitHub Actions CI, semver tagging |

### 5.2 Phase 1 — Scaffolding

- Initialize package with `npm init`, set `"type": "module"` (ESM) or `commonjs` based on target Node versions.
- Set up `bin` field in `package.json` pointing to `bin/target-run.js`.
- Implement `--help` output listing all flags and the naming convention.
- Implement `--version` reading from `package.json`.
- Implement `--dry-run` flag that prints the resolved script name without running it.
- Implement `--verbose` flag for extra diagnostic output (detected platform, arch, resolved key).

### 5.3 Phase 2 — Core Resolution Logic

- Implement `detect.js` with injectable getters for testability.
- Implement `resolver.js` with the five-step fallback chain.
- Read `package.json` from `process.cwd()` by default; walk up the directory tree to support monorepos (stop at first `package.json` that contains a `scripts` field).
- Use `process.env.npm_lifecycle_event` to get the calling script name automatically — no need for the user to pass the base name explicitly.
- Validate that the `scripts` map exists before attempting resolution.

### 5.4 Phase 3 — Process Runner

- Detect package manager from `npm_execpath`. Extract the executable name (`npm`, `yarn`, `pnpm`, `bun`).
- Spawn with `{ stdio: 'inherit' }` to fully pass through stdout/stderr/stdin including color codes.
- Propagate exit code from the child process as the exit code of `target-run` itself.
- Forward `SIGINT` and `SIGTERM` to the child process to allow clean interrupt handling.
- Do not use `shell: true` — this avoids shell injection risk and improves Windows compatibility.

---

## 6. Edge Cases & Error Handling

### 6.1 No Matching Script Found

When no script matches any fallback level, the tool prints a clear diagnostic and exits with code 1:

```
[target-run] ERROR: No matching script found.
  Calling script : test
  Platform       : linux
  Architecture   : arm64
  Tried keys     : test:linux:arm64, test:linux, test:arm64, test:default
  Available      : test:linux:x64, test:darwin:arm64, test:win32:x64
```

### 6.2 Called Outside npm Scripts

If `process.env.npm_lifecycle_event` is undefined (e.g. run directly as `node target-run.js`), the tool either exits with a descriptive error or, if `--script <n>` is passed explicitly, uses that value.

### 6.3 Missing or Malformed package.json

If `package.json` cannot be found or parsed:

- Throw `PackageJsonReadError` with the file path and parse error message.
- Print a human-readable error and exit with code 1.

### 6.4 Scripts Map is Empty or Absent

If the `scripts` field does not exist or is empty, emit a warning and exit cleanly with code 0 (no-op), since this could indicate a workspace root.

### 6.5 Circular or Self-Referencing Scripts (Lifecycle Hooks)

If the base script's own value is `target-run` and no platform variant is found, this is the expected pattern for optional lifecycle hooks. The tool exits with code 0 silently (level 5 in the fallback chain) rather than erroring. This distinguishes between two cases:

- **`pretest` with no variant** → intended no-op, exit 0.
- **`test` with no variant** → likely a misconfiguration, exit 1 (or exit 0 with `--optional`).

A true infinite-loop cycle (e.g. a platform variant whose command is also `target-run`) is detected by checking the resolved command value before spawning, and aborts with a `CircularDispatchError`.

### 6.6 Windows Path Handling

On `win32`, `npm_execpath` may include `.cmd` extensions and backslashes. Normalize paths using `path.normalize` and handle `.cmd` by passing through `cmd.exe` when needed.

---

## 7. Testing Strategy

### 7.1 Unit Tests (Jest)

| Module | Test Scenarios |
|--------|----------------|
| `detect.js` | Returns correct platform/arch; mock overrides work in tests |
| `resolver.js` | Exact match; OS-only fallback; arch-only fallback; default fallback; no match error; self-reference silent skip; `--optional` exits 0; `--required` overrides level 5 skip; circular platform variant detected |
| `runner.js` | npm detected; pnpm detected; yarn detected; bun detected; exit code propagation; signal forwarding |
| `errors.js` | All error classes have correct `name`, `message`, and metadata properties |

### 7.2 Integration Tests

Integration tests use real `package.json` fixture files in a temp directory and run the full CLI via `child_process.execSync` to verify end-to-end behavior:

- Correct script runs on current platform/arch.
- Fallback scripts run when exact match is absent.
- Exit code from the sub-script propagates correctly.
- Dry-run prints the resolved script name without executing.
- Verbose mode prints detection diagnostics.
- `pretest` with no platform variant exits 0 silently (level 5 skip).
- `pretest` with `--required` and no platform variant exits 1.
- `test` with no platform variant and `--optional` exits 0.

### 7.3 CI Matrix

GitHub Actions workflow runs tests on all three major platforms:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
    node: ['16', '18', '20', '22']
```

---

## 8. API & CLI Reference

### 8.1 CLI Flags

| Flag | Description |
|------|-------------|
| `--help`, `-h` | Print usage instructions and naming convention |
| `--version`, `-v` | Print the package version |
| `--dry-run` | Resolve and print the target script key without executing |
| `--verbose` | Print platform, arch, resolved key, and runner details |
| `--script <n>` | Override the base script name (bypasses `npm_lifecycle_event`) |
| `--cwd <path>` | Set the working directory for `package.json` lookup (default: `process.cwd()`) |
| `--optional` | Exit 0 silently if no matching script is found (instead of exit 1) |
| `--required` | Exit 1 if no matching script is found, even for pre/post hooks (overrides level 5 skip) |

### 8.2 Environment Variables

| Variable | Description |
|----------|-------------|
| `npm_lifecycle_event` | Set by npm/yarn/pnpm/bun — used to determine the calling script name |
| `npm_execpath` | Path to the package manager executable — used for subprocess spawning |
| `RSOA_DEBUG` | When set to `1`, enables verbose output (alternative to `--verbose`) |
| `RSOA_DRY_RUN` | When set to `1`, enables dry-run (alternative to `--dry-run`) |

---

## 9. Package Configuration

### 9.1 package.json (published)

```json
{
  "name": "target-run",
  "version": "1.0.0",
  "description": "OS & architecture-aware npm script dispatcher",
  "bin": { "target-run": "bin/target-run.js" },
  "engines": { "node": ">=16.0.0" },
  "files": ["bin/", "src/"],
  "keywords": ["npm-script", "cross-platform", "os", "arch", "runner"],
  "dependencies": {},
  "devDependencies": {
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "cross-env": "^7.0.0"
  }
}
```

### 9.2 Dependency Policy

The package has zero production dependencies by design. All functionality relies exclusively on Node.js built-in modules:

- `os` — platform and arch detection
- `fs`, `path` — `package.json` resolution
- `child_process` — subprocess spawning
- `process` — environment, exit codes, signals

---

## 10. Compatibility Matrix

### Package Managers

| Package Manager | Supported | Detection Method | Notes |
|-----------------|-----------|------------------|-------|
| npm | ✅ Full | `npm_execpath` | Default fallback |
| pnpm | ✅ Full | `npm_execpath` contains `pnpm` | Works with workspaces |
| yarn | ✅ Full | `npm_execpath` contains `yarn` | Classic and Berry |
| bun | ✅ Full | `npm_execpath` contains `bun` | `bun run` supported |

### Platforms & Architectures

| Platform | Supported Architectures |
|----------|------------------------|
| `linux` | `x64`, `arm64`, `ia32`, `arm`, `mips`, `mipsel`, `ppc64`, `s390x` |
| `darwin` | `x64`, `arm64` (Apple Silicon) |
| `win32` | `x64`, `ia32`, `arm64` (Win on ARM) |
| `freebsd` | `x64`, `arm64` |
| `openbsd` | `x64` |

---

## 11. Security Considerations

- No `shell: true` is used in `child_process.spawnSync`, preventing shell injection via environment variables or script arguments.
- The resolved script command is never `eval`'d or passed through a shell — it is passed as an argument array to the package manager.
- `package.json` is read from the filesystem, not from `npm_package_*` env vars, to prevent environment variable injection attacks.
- The tool never reads, transmits, or logs sensitive environment variable values.
- Circular dispatch detection prevents denial-of-service via recursive process forking.

---

## 12. Open Questions & Future Work

### 12.1 Open Questions

- Should the tool support a `.target-run.json` config file for more complex routing rules (e.g. libc variant `glibc` vs `musl` for Linux)?
- Should the fallback chain be configurable (e.g. disable arch-only fallback for strict environments)?
- Should the tool print a warning (rather than error) when falling back from an exact match, to surface potential misconfiguration?

### 12.2 Future Enhancements

- **v1.1:** Add `--list` flag to print all available platform-specific scripts in the current package.
- **v1.2:** Config file support for libc-level discrimination (`glibc` vs `musl`).
- **v1.3:** Plugin API allowing custom resolver functions beyond the built-in fallback chain.
- **v2.0:** Optional TypeScript rewrite with full type definitions for programmatic API consumers.

---

## 13. Appendix

### A. `os.platform()` Values

| Value | Operating System |
|-------|-----------------|
| `win32` | Windows (all versions including 64-bit) |
| `darwin` | macOS and macOS Server |
| `linux` | Linux (all distributions) |
| `freebsd` | FreeBSD |
| `openbsd` | OpenBSD |
| `sunos` | SunOS / Solaris / Illumos |
| `aix` | IBM AIX |

### B. `os.arch()` Values

| Value | Architecture |
|-------|-------------|
| `x64` | 64-bit x86 (Intel/AMD, most servers and desktops) |
| `arm64` | 64-bit ARM (Apple Silicon M-series, AWS Graviton, Raspberry Pi 4+) |
| `ia32` | 32-bit x86 (legacy Windows, older Node builds) |
| `arm` | 32-bit ARM (Raspberry Pi 2/3, embedded Linux) |
| `mips` | 32-bit MIPS big-endian (embedded, routers) |
| `mipsel` | 32-bit MIPS little-endian |
| `ppc64` | 64-bit PowerPC (IBM systems) |
| `s390x` | IBM Z mainframe architecture |

### C. Similar Packages & Differentiation

| Package | Key Difference vs `target-run` |
|---------|----------------------------------------|
| `run-script-os` | No architecture support — only dispatches on OS |
| `cross-env` | Sets environment variable syntax, does NOT dispatch scripts |
| `env-cmd` | Loads `.env` files, does NOT dispatch on platform/arch |
| `npm-run-all` | Parallel/sequential runner; no platform/arch awareness |
| `scripty` | Loads scripts from files; no platform dispatch convention |

---

*End of Document*