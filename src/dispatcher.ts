import fs from "node:fs";
import path from "node:path";
import { type Detector, defaultDetector } from "./detector.js";
import {
	LifecycleEventError,
	PackageJsonError,
	ScriptNotFoundError,
} from "./errors.js";
import { resolveScript } from "./resolver.js";
import { run } from "./runner.js";

export type DispatcherOptions = {
	/** Resolve and print the script key without executing anything. */
	dryRun?: boolean;
	/** Print platform, arch, resolved key and runner details to stderr. */
	verbose?: boolean;
	/**
	 * Exit 0 silently when no matching script is found instead of erroring.
	 * Useful for hooks that only apply to some platforms.
	 */
	optional?: boolean;
	/**
	 * Exit 1 when no matching script is found, even for lifecycle hooks (e.g.
	 * `preinstall`) whose missing platform variant would normally be skipped
	 * silently. Use this to enforce that every target platform has a variant.
	 */
	required?: boolean;
	/** Working directory used to locate package.json. Defaults to process.cwd(). */
	cwd?: string;
	/**
	 * Override the base script name instead of reading npm_lifecycle_event.
	 * Useful when invoking the dispatcher programmatically or from --script flag.
	 */
	baseScript?: string;
	/** Injectable OS detector — supply a stub in unit tests. */
	detector?: Detector;
};

/**
 * Walks up the directory tree from startDir until it finds a package.json.
 */
const findPackageJson = (startDir: string): string | null => {
	let dir = startDir;
	while (true) {
		const candidate = path.join(dir, "package.json");
		if (fs.existsSync(candidate)) return candidate;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
};

/**
 * Reads and returns the `scripts` field from a package.json file.
 * @throws {PackageJsonError} on read or parse failures.
 */
const readScripts = (pkgPath: string): Record<string, string> => {
	try {
		const content = fs.readFileSync(pkgPath, "utf8");
		const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
		return pkg.scripts ?? {};
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new PackageJsonError(`Failed to read/parse ${pkgPath}: ${msg}`);
	}
};

/**
 * Main entry point. Resolves the correct platform/arch script and runs it.
 * All errors are caught, printed to stderr and result in exit code 1.
 */
export const dispatch = (options: DispatcherOptions = {}): void => {
	try {
		const cwd = options.cwd ?? process.cwd();
		const detector = options.detector ?? defaultDetector;

		const pkgPath = findPackageJson(cwd);
		if (!pkgPath) {
			throw new PackageJsonError(
				`No package.json found searching upward from: ${cwd}`,
			);
		}

		const scripts = readScripts(pkgPath);
		if (Object.keys(scripts).length === 0) {
			process.exit(0);
		}

		const baseScript = options.baseScript ?? process.env["npm_lifecycle_event"];
		if (!baseScript) {
			throw new LifecycleEventError();
		}

		const platform = detector.getPlatform();
		const arch = detector.getArch();

		if (options.verbose) {
			console.error(`[target-run] Script          : ${baseScript}`);
			console.error(`[target-run] Platform        : ${platform}`);
			console.error(`[target-run] Architecture    : ${arch}`);
		}

		const result = resolveScript({ base: baseScript, platform, arch, scripts });

		if (result.key === null) {
			// Level 5 — lifecycle hook self-reference, no platform variant found.
			if (result.skipped && !options.required) {
				if (options.verbose) {
					console.error(
						`[target-run] No platform variant for '${baseScript}', skipping silently (self-reference).`,
					);
				}
				process.exit(0);
			}

			// Level 6 — genuinely no match (or --required forces hard failure on level 5).
			if (options.optional) {
				if (options.verbose) {
					console.error(
						`[target-run] No matching script found, exiting 0 (--optional).`,
					);
				}
				process.exit(0);
			}

			const available = Object.keys(scripts).filter((k) =>
				k.startsWith(`${baseScript}:`),
			);
			throw new ScriptNotFoundError(
				`No matching script for '${baseScript}' on ${platform}/${arch}`,
				baseScript,
				platform,
				arch,
				result.tried,
				available,
			);
		}

		if (options.verbose) {
			console.error(`[target-run] Resolved        : ${result.key}`);
		}

		const exitCode = run({
			scriptKey: result.key,
			command: result.command,
			dryRun: options.dryRun,
			verbose: options.verbose,
		});

		process.exit(exitCode);
	} catch (err) {
		if (err instanceof ScriptNotFoundError) {
			console.error("[target-run] ERROR: No matching script found.");
			console.error(`  Calling script : ${err.baseScript}`);
			console.error(`  Platform       : ${err.platform}`);
			console.error(`  Architecture   : ${err.arch}`);
			console.error(`  Tried keys     : ${err.tried.join(", ")}`);
			console.error(
				`  Available      : ${err.available.join(", ") || "(none)"}`,
			);
		} else if (err instanceof Error) {
			console.error(`[target-run] ERROR: ${err.message}`);
		}
		process.exit(1);
	}
};
