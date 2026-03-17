import { spawnSync } from "node:child_process";
import { CircularDispatchError } from "./errors.js";

/**
 * Infers the package manager by inspecting npm_execpath, which all major
 * package managers (npm, pnpm, yarn, bun) set automatically when running scripts.
 */
const detectPackageManager = (): string => {
	const execPath = process.env["npm_execpath"];
	if (!execPath) return "npm";
	const normalized = execPath.toLowerCase().replace(/\\/g, "/");
	if (normalized.includes("pnpm")) return "pnpm";
	if (normalized.includes("yarn")) return "yarn";
	if (normalized.includes("bun")) return "bun";
	return "npm";
};

type RunnerOptions = {
	scriptKey: string;
	command: string;
	dryRun?: boolean;
	verbose?: boolean;
};

/**
 * Spawns the resolved script via the detected package manager.
 * Returns the exit code of the child process.
 *
 * @throws {CircularDispatchError} If the resolved command would invoke target-run again.
 * @throws {Error} If the spawned process fails to start.
 */
export const run = (options: RunnerOptions): number => {
	const { scriptKey, command, dryRun, verbose } = options;

	// Guard against circular dispatch before spawning anything.
	const trimmed = command.trim();
	if (trimmed === "target-run" || trimmed.startsWith("target-run ")) {
		throw new CircularDispatchError(scriptKey, command);
	}

	const packageManager = detectPackageManager();

	if (verbose) {
		console.error(`[target-run] Package manager : ${packageManager}`);
		console.error(
			`[target-run] Running         : ${packageManager} run ${scriptKey}`,
		);
	}

	if (dryRun) {
		console.log(`[target-run] Would run: ${packageManager} run ${scriptKey}`);
		return 0;
	}

	const result = spawnSync(packageManager, ["run", scriptKey], {
		stdio: "inherit",
		shell: false,
	});

	if (result.error) {
		throw result.error;
	}

	return result.status ?? 1;
};
