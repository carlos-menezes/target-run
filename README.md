# target-run

![NPM Version](https://img.shields.io/npm/v/target-run) ![NPM Downloads](https://img.shields.io/npm/dt/target-run) ![NPM License](https://img.shields.io/npm/l/target-run)

Platform-aware script runner for Node.js projects.

```sh
pnpm add -D target-run
```

Set a script body to `target-run`, then define platform/arch variants:

```json
{
  "scripts": {
    "test": "target-run",
    "test:darwin:arm64": "jest --config jest.apple-silicon.config.ts",
    "test:linux:x64": "jest --config jest.linux.config.ts",
    "test:default": "jest"
  }
}
```

Candidates are resolved in order:

1. `<script>:<platform>:<arch>`
2. `<script>:<platform>`
3. `<script>:<arch>`
4. `<script>:default`

Platform values come from `os.platform()` and arch from `os.arch()`.

## Example

Given this `package.json` on a Linux x64 machine:

```json
{
  "scripts": {
    "build": "target-run",
    "build:linux:x64": "node dist/index-linux-x64.js",
    "build:darwin:arm64": "node dist/index-darwin-arm64.js",
    "build:default": "node dist/index.js"
  }
}
```

```sh
$ pnpm build
# linux/x64   → node dist/index-linux-x64.js
# darwin/arm64 → node dist/index-darwin-arm64.js
# win32/x64   → node dist/index.js  (fallback)
```

## CLI options

| Flag | Description |
|---|---|
| `--dry-run` | Print the resolved key without executing |
| `--verbose` | Print platform, arch, resolved key and runner |
| `--optional` | Exit 0 silently when no match is found |
| `--required` | Exit 1 when no match is found |
| `--script <name>` | Override the base script name |
| `--cwd <path>` | Set the working directory for `package.json` lookup |