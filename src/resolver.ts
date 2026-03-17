export type ResolveScriptParams = {
	base: string;
	platform: string;
	arch: string;
	scripts: Record<string, string>;
};

/** A script was found.
 * Key and command are both guaranteed non-null. */
type ResolveScriptFound = {
	key: string;
	command: string;
	tried: string[];
	skipped?: never;
};

/** No script matched.
 * Key/command are null; skipped signals a silent skip. */
type ResolveScriptMissed = {
	key: null;
	command: null;
	tried: string[];
	/** True when the base script is `target-run` itself and no platform variant
	 *  was found; the canonical signal for a silent lifecycle-hook skip. */
	skipped?: boolean;
};

export type ResolveScriptResult = ResolveScriptFound | ResolveScriptMissed;

/**
 * Resolves the correct script key using the fallback chain:
 *
 * 1. `<base>:<platform>:<arch>` : exact match
 * 2. `<base>:<platform>`        : OS-only match
 * 3. `<base>:<arch>`            : arch-only match
 * 4. `<base>:default`           : explicit default
 * 5. Self-reference skip        : if base script value is "target-run", skipped=true
 *
 * Returns `{ key: null, command: null, tried }` (with optional `skipped`)
 * when nothing matches.
 */
export const resolveScript = (
	params: ResolveScriptParams,
): ResolveScriptResult => {
	const { base, platform, arch, scripts } = params;
	const tried: string[] = [];

	const candidates = [
		`${base}:${platform}:${arch}`,
		`${base}:${platform}`,
		`${base}:${arch}`,
		`${base}:default`,
	];

	for (const key of candidates) {
		tried.push(key);
		if (scripts[key]) {
			return { key, command: scripts[key] as string, tried };
		}
	}

	// Level 5: self-reference skip for optional lifecycle hooks.
	if (scripts[base] === "target-run") {
		return { key: null, command: null, tried, skipped: true };
	}

	return { key: null, command: null, tried };
};
