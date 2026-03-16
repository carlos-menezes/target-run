#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { dispatch } from "../src/dispatcher.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
	console.log(`target-run — OS & architecture-aware npm script dispatcher

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

Environment variables:
  RSOA_DEBUG=1      Enable verbose output (same as --verbose)
  RSOA_DRY_RUN=1    Enable dry-run mode (same as --dry-run)
`);
	process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
	const pkgPath = path.join(__dirname, "../../package.json");
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
	dryRun: args.includes("--dry-run") || process.env["RSOA_DRY_RUN"] === "1",
	verbose: args.includes("--verbose") || process.env["RSOA_DEBUG"] === "1",
	optional: args.includes("--optional"),
	required: args.includes("--required"),
	baseScript: getArg("--script"),
	cwd: getArg("--cwd"),
});
