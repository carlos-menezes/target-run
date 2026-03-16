# target-run

![NPM Version](https://img.shields.io/npm/v/target-run) ![NPM Downloads](https://img.shields.io/npm/dt/target-run) ![NPM License](https://img.shields.io/npm/l/target-run)

OS & architecture-aware script dispatcher for `package.json`.

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
    "build:linux:x64": "gcc -O2 -o out main.c",
    "build:darwin": "clang -o out main.c",
    "build:default": "cc -o out main.c"
  }
}
```

```sh
$ pnpm build
# Runs: gcc -O2 -o out main.c

$ pnpm build --dry-run
# Prints: build:linux:x64

$ pnpm build --verbose
# platform: linux  arch: x64  key: build:linux:x64  runner: pnpm
# Runs: gcc -O2 -o out main.c
```

## CLI options

| Flag | Description |
|---|---|
| `--dry-run` | Print the resolved key without executing |
| `--verbose` | Print platform, arch, resolved key, and runner |
| `--optional` | Exit 0 silently when no match is found |
| `--required` | Exit 1 when no match is found |
| `--script <name>` | Override the base script name |
| `--cwd <path>` | Set the working directory for `package.json` lookup |