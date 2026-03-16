/**
 * Base error class for all target-run errors.
 */
export class DispatcherError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DispatcherError";
	}
}

/**
 * Thrown when package.json cannot be found or parsed.
 */
export class PackageJsonError extends DispatcherError {
	constructor(message: string) {
		super(message);
		this.name = "PackageJsonError";
	}
}

/**
 * Thrown when no matching script is found and the invocation is not optional.
 * Carries diagnostic metadata for a human-readable error message.
 */
export class ScriptNotFoundError extends DispatcherError {
	constructor(
		message: string,
		public readonly baseScript: string,
		public readonly platform: string,
		public readonly arch: string,
		public readonly tried: string[],
		public readonly available: string[],
	) {
		super(message);
		this.name = "ScriptNotFoundError";
	}
}

/**
 * Thrown when npm_lifecycle_event is not set, meaning the tool was not
 * invoked through a package manager script.
 */
export class LifecycleEventError extends DispatcherError {
	constructor() {
		super(
			"npm_lifecycle_event is not set. target-run must be invoked via a package manager script.",
		);
		this.name = "LifecycleEventError";
	}
}

/**
 * Thrown when a resolved platform-specific script command would invoke
 * target-run again, creating an infinite subprocess loop.
 */
export class CircularDispatchError extends DispatcherError {
	constructor(
		public readonly scriptKey: string,
		public readonly command: string,
	) {
		super(
			`Circular dispatch detected: '${scriptKey}' resolves to '${command}', which would invoke target-run again.`,
		);
		this.name = "CircularDispatchError";
	}
}
