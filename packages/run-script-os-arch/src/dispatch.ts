import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import {
	type ResolveScriptParams,
	type ResolveScriptResult,
	type DispatcherOptions,
	PackageJsonError,
	ScriptNotFoundError,
	LifecycleEventError,
} from './types.js';

const PREFIX = '[run-script-os-arch]';

/**
 * Recursively searches upward from the start directory to find the nearest package.json.
 * @param startDir - Directory to start searching from.
 * @returns Absolute path to package.json or null if not found.
 * @throws {PackageJsonError} If package.json cannot be parsed.
 */
const findPackageJson = (startDir: string): string | null => {
	let dir = startDir;
	while (true) {
		const pkgPath = path.join(dir, 'package.json');
		if (fs.existsSync(pkgPath)) return pkgPath;
		const parent = path.dirname(dir);
		if (parent === dir) break;
		dir = parent;
	}
	return null;
};

/**
 * Reads the scripts object from a package.json file.
 * @param pkgPath - Absolute path to package.json.
 * @returns Scripts map from package.json or empty object.
 * @throws {PackageJsonError} If file cannot be read or parsed.
 */
const readScripts = (pkgPath: string): Record<string, string> => {
	try {
		const content = fs.readFileSync(pkgPath, 'utf8');
		const pkg = JSON.parse(content);
		return pkg.scripts || {};
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		throw new PackageJsonError(`Failed to read/parse ${pkgPath}: ${message}`);
	}
};

/**
 * Resolves the correct script key using the fallback chain.
 *
 * Resolution order:
 * 1. `<base>:<platform>:<arch>` - Exact match
 * 2. `<base>:<platform>` - OS-only match
 * 3. `<base>:<arch>` - Architecture-only match
 * 4. `<base>:default` - Default match
 * 5. Self-reference skip (if base script is 'run-script-os-arch', skip silently)
 *
 * @param params - Parameters for resolution (base, platform, arch, scripts).
 * @returns Object with resolved key, command, and tried keys.
 */
const resolveScript = (params: ResolveScriptParams): ResolveScriptResult => {
	const { base, platform, arch, scripts } = params;
	const tried: string[] = [];

	// Resolution chain
	const patterns = [
		`${base}:${platform}:${arch}`,
		`${base}:${platform}`,
		`${base}:${arch}`,
		`${base}:default`,
	];

	for (const key of patterns) {
		tried.push(key);
		if (scripts[key]) {
			return { key, command: scripts[key], tried };
		}
	}

	// Level 5: self-reference skip for lifecycle hooks
	if (scripts[base] === 'run-script-os-arch') {
		return { key: null, command: null, tried, skipped: true };
	}

	return { key: null, command: null, tried };
};

/**
 * Prints detailed error diagnostics to stderr.
 */
const printErrorDiagnostics = (
	baseScript: string,
	platform: string,
	arch: string,
	tried: string[],
	available: string[]
): void => {
	console.error(`${PREFIX} ERROR: No matching script found.`);
	console.error(`  Calling script : ${baseScript}`);
	console.error(`  Platform       : ${platform}`);
	console.error(`  Architecture   : ${arch}`);
	console.error(`  Tried keys     : ${tried.join(', ')}`);
	console.error(
		`  Available      : ${available.length > 0 ? available.join(', ') : '(none)'}`
	);
};

/**
 * Detects the package manager from npm_execpath environment variable.
 * Falls back to 'npm' if not determinable.
 */
const detectPackageManager = (): string => {
	const execPath = process.env['npm_execpath'];
	if (!execPath) return 'npm';

	// Extract the package manager name from the path
	const normalized = execPath.replace(/\\/g, '/');
	if (normalized.includes('pnpm')) return 'pnpm';
	if (normalized.includes('yarn')) return 'yarn';
	if (normalized.includes('bun')) return 'bun';

	return 'npm';
};

/**
 * Spawns the package manager to run the resolved script.
 * @param scriptKey - The resolved script key (e.g., 'test:darwin:arm64')
 * @param verbose - Whether to print verbose output
 */
const spawnScript = (scriptKey: string, verbose?: boolean): void => {
	const pm = detectPackageManager();

	if (verbose) {
		console.log(`${PREFIX} Using package manager: ${pm}`);
	}

	const result = spawnSync(pm, ['run', scriptKey], {
		stdio: 'inherit',
		shell: false,
	});

	// Exit with the same code as the child process
	if (result.status !== null) {
		process.exit(result.status);
	}

	// If no exit code, exit with 1 (error)
	if (result.error) {
		console.error(`${PREFIX} Failed to spawn ${pm}: ${result.error.message}`);
		process.exit(1);
	}

	process.exit(0);
};

/**
 * Main dispatch function. Orchestrates the entire flow.
 * @param options - Optional configuration flags.
 * @throws {PackageJsonError} If package.json cannot be found or parsed.
 * @throws {LifecycleEventError} If npm_lifecycle_event is not set.
 * @throws {ScriptNotFoundError} If no matching script is found and not optional.
 */
const dispatch = (options: DispatcherOptions = {}): void => {
	try {
		const cwd = options.cwd || process.cwd();

		// Find package.json
		const pkgPath = findPackageJson(cwd);
		if (!pkgPath) {
			throw new PackageJsonError(
				`package.json not found starting from ${cwd}`
			);
		}

		if (options.verbose) {
			console.log(`${PREFIX} Found package.json at ${pkgPath}`);
		}

		// Read scripts
		const scripts = readScripts(pkgPath);
		if (!scripts || Object.keys(scripts).length === 0) {
			if (options.verbose) {
				console.warn(`${PREFIX} WARNING: No scripts found in package.json.`);
			}
			process.exit(0);
		}

		// Get base script name from environment
		const baseScript = process.env['npm_lifecycle_event'];
		if (!baseScript) {
			throw new LifecycleEventError();
		}

		if (options.verbose) {
			console.log(`${PREFIX} Calling script: ${baseScript}`);
		}

		// Detect platform and architecture
		const platform = os.platform() as NodeJS.Platform;
		const arch = os.arch() as NodeJS.Architecture;

		if (options.verbose) {
			console.log(`${PREFIX} Detected platform: ${platform}`);
			console.log(`${PREFIX} Detected architecture: ${arch}`);
		}

		// Resolve script
		const result = resolveScript({ base: baseScript, platform, arch, scripts });

		if (result.skipped) {
			if (options.verbose) {
				console.log(
					`${PREFIX} Script is self-referencing lifecycle hook. Skipping.`
				);
			}
			process.exit(0);
		}

		if (result.key && result.command) {
			if (options.verbose) {
				console.log(`${PREFIX} Resolved to script key: ${result.key}`);
				console.log(`${PREFIX} Command: ${result.command}`);
			}

			if (options.dryRun) {
				console.log(`${PREFIX} [DRY RUN] Would execute: npm run ${result.key}`);
				process.exit(0);
			}

			console.log(
				`${PREFIX} Dispatching to script: ${result.key}`
			);

			// Spawn the resolved script
			spawnScript(result.key, options.verbose);
		} else {
			// No match found
			const available = Object.keys(scripts);
			printErrorDiagnostics(baseScript, platform, arch, result.tried, available);

			if (options.optional) {
				if (options.verbose) {
					console.log(`${PREFIX} Optional flag set. Exiting cleanly.`);
				}
				process.exit(0);
			}

			throw new ScriptNotFoundError(
				`No matching script found for ${baseScript}`,
				baseScript,
				platform,
				arch,
				result.tried,
				available
			);
		}
	} catch (err) {
		if (err instanceof Error) {
			console.error(`${PREFIX} ${err.name}: ${err.message}`);
		} else {
			console.error(`${PREFIX} Unknown error: ${err}`);
		}
		process.exit(1);
	}
};

/**
 * Entry point for the CLI.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
	const options: DispatcherOptions = {
		verbose: process.env['RSOA_DEBUG'] === '1',
		dryRun: process.env['RSOA_DRY_RUN'] === '1',
	};

	// Parse command-line flags
	for (let i = 2; i < process.argv.length; i++) {
		switch (process.argv[i]) {
			case '--verbose':
				options.verbose = true;
				break;
			case '--dry-run':
				options.dryRun = true;
				break;
			case '--optional':
				options.optional = true;
				break;
			case '--required':
				options.required = true;
				break;
			case '--cwd':
				const cwdValue = process.argv[++i];
				if (cwdValue) options.cwd = cwdValue;
				break;
		}
	}

	dispatch(options);
}

export { dispatch };
