#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dispatch } from "../src/dispatcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
	console.log(`target-run — OS & architecture-aware script dispatcher

Usage: target-run [options]

Options:
  --help, -h        Print this help message
  --version, -v     Print the package version
  --dry-run         Resolve and print the target script key without executing
  --verbose         Print platform, arch, resolved key and runner details
  --optional        Exit 0 silently when no matching script is found instead of
                    erroring — useful for hooks that only apply to some platforms
  --required        Exit 1 when no matching script is found, even for lifecycle hooks
                    (e.g. preinstall) whose missing variant would normally be skipped
                    silently — use this to enforce that every platform has a variant
  --script <name>   Override the base script name (bypasses npm_lifecycle_event)
  --cwd <path>      Set the working directory for package.json lookup

Naming convention:
  <script>:<platform>:<arch>   Exact match       (e.g. test:linux:x64)
  <script>:<platform>          OS-only fallback  (e.g. test:linux)
  <script>:<arch>              Arch-only fallback (e.g. test:x64)
  <script>:default             Explicit default
`);
	process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
	const pkgPath = path.join(__dirname, "../package.json");
	const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
		version: string;
	};
	console.log(pkg.version);
	process.exit(0);
}

const getArg = (flag: string): string | undefined => {
	const idx = args.indexOf(flag);
	return idx !== -1 ? args[idx + 1] : undefined;
};

dispatch({
	dryRun: args.includes("--dry-run"),
	verbose: args.includes("--verbose"),
	optional: args.includes("--optional"),
	required: args.includes("--required"),
	baseScript: getArg("--script"),
	cwd: getArg("--cwd"),
});
