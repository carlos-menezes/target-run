/**
 * Input parameters for script resolution.
 */
export type ResolveScriptParams = {
	base: string;
	platform: string;
	arch: string;
	scripts: Record<string, string>;
};

/**
 * Result of script resolution.
 */
export type ResolveScriptResult = {
	key: string | null;
	command: string | null;
	tried: string[];
	skipped?: boolean;
};

/**
 * CLI options passed to the dispatcher.
 */
export type DispatcherOptions = {
	dryRun?: boolean;
	verbose?: boolean;
	optional?: boolean;
	required?: boolean;
	cwd?: string;
};

/**
 * Base error class for dispatcher errors.
 */
export class DispatcherError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DispatcherError';
	}
}

/**
 * Thrown when package.json cannot be found or parsed.
 */
export class PackageJsonError extends DispatcherError {
	constructor(message: string) {
		super(message);
		this.name = 'PackageJsonError';
	}
}

/**
 * Thrown when no matching script is found and not optional.
 */
export class ScriptNotFoundError extends DispatcherError {
	constructor(
		message: string,
		public baseScript: string,
		public platform: string,
		public arch: string,
		public tried: string[],
		public available: string[]
	) {
		super(message);
		this.name = 'ScriptNotFoundError';
	}
}

/**
 * Thrown when npm_lifecycle_event is not available.
 */
export class LifecycleEventError extends DispatcherError {
	constructor() {
		super('npm_lifecycle_event environment variable not set. Run via npm scripts.');
		this.name = 'LifecycleEventError';
	}
}
