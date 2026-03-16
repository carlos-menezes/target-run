# target-run

OS & architecture-aware script dispatcher. Define platform-specific scripts
in `package.json` and let `target-run` pick the right one at runtime.

## Installation

```sh
npm install --save-dev target-run
# or
pnpm add -D target-run
# or
yarn add -D target-run
```

## How it works

Replace any script body with `target-run`, then add variants using the naming convention:

```sh
<script>:<platform>:<arch>
```

`target-run` tries candidates in this order and runs the first match:

1. `<script>:<platform>:<arch>`: exact (e.g. `test:linux:x64`)
2. `<script>:<platform>`: OS-only (e.g. `test:darwin`)
3. `<script>:<arch>`: arch-only (e.g. `test:arm64`)
4. `<script>:default`: explicit fallback

Platform values come from `os.platform()` (`win32`, `darwin`, `linux`, etc) and
arch values from `os.arch()` (`x64`, `arm64`, `ia32`, etc).

## Example

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

Running `npm test` (or `pnpm test`, `yarn test`, `bun run test`) dispatches
to the variant that matches the current machine.

## CLI options

```sh
Usage: target-run [options]

Options:
  --help, -h        Print this help message
  --version, -v     Print the package version
  --dry-run         Resolve and print the target script key without executing
  --verbose         Print platform, arch, resolved key, and runner details
  --optional        Exit 0 silently when no matching script is found
  --required        Exit 1 when no matching script is found (overrides lifecycle hook skip)
  --script <name>   Override the base script name (bypasses npm_lifecycle_event)
  --cwd <path>      Set the working directory for package.json lookup

Naming convention:
  <script>:<platform>:<arch>   Exact match       (e.g. test:linux:x64)
  <script>:<platform>          OS-only fallback  (e.g. test:linux)
  <script>:<arch>              Arch-only fallback (e.g. test:x64)
  <script>:default             Explicit default
```