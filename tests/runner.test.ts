import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CircularDispatchError } from "../src/errors.js";
import { run } from "../src/runner.js";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

import { spawnSync } from "node:child_process";

const mockSpawnSync = vi.mocked(spawnSync);

beforeEach(() => {
	// Use npm as the package manager in all tests unless overridden.
	delete process.env["npm_execpath"];
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("run : circular dispatch guard", () => {
	it("throws CircularDispatchError when command is exactly 'target-run'", () => {
		expect(() =>
			run({ scriptKey: "build", command: "target-run" }),
		).toThrowError(CircularDispatchError);
	});

	it("throws CircularDispatchError when command starts with 'target-run '", () => {
		expect(() =>
			run({ scriptKey: "build", command: "target-run --verbose" }),
		).toThrowError(CircularDispatchError);
	});

	it("does not throw for commands that merely contain 'target-run' mid-string", () => {
		mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as ReturnType<
			typeof spawnSync
		>);
		expect(() =>
			run({ scriptKey: "build", command: "echo target-run" }),
		).not.toThrow();
	});
});

describe("run : dry-run mode", () => {
	it("returns 0 without spawning", () => {
		const code = run({ scriptKey: "test", command: "vitest", dryRun: true });
		expect(code).toBe(0);
		expect(mockSpawnSync).not.toHaveBeenCalled();
	});

	it("logs the would-run message to stdout", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		run({ scriptKey: "test", command: "vitest", dryRun: true });
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("Would run"));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("test"));
	});
});

describe("run : verbose mode", () => {
	it("logs package manager and script key to stderr", () => {
		mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as ReturnType<
			typeof spawnSync
		>);
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		run({ scriptKey: "build", command: "tsc", verbose: true });
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("npm"));
		expect(spy).toHaveBeenCalledWith(expect.stringContaining("build"));
	});
});

describe("run : spawn behaviour", () => {
	it("passes the script key to the package manager, not the raw command", () => {
		mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as ReturnType<
			typeof spawnSync
		>);
		run({ scriptKey: "lint", command: "biome lint ." });
		expect(mockSpawnSync).toHaveBeenCalledWith(
			"npm",
			["run", "lint"],
			expect.objectContaining({ stdio: "inherit", shell: false }),
		);
	});

	it("returns the exit status from the child process", () => {
		mockSpawnSync.mockReturnValue({
			status: 42,
			error: undefined,
		} as ReturnType<typeof spawnSync>);
		expect(run({ scriptKey: "lint", command: "biome lint ." })).toBe(42);
	});

	it("returns 1 when status is null", () => {
		mockSpawnSync.mockReturnValue({
			status: null,
			error: undefined,
		} as ReturnType<typeof spawnSync>);
		expect(run({ scriptKey: "lint", command: "biome lint ." })).toBe(1);
	});

	it("re-throws when spawnSync sets result.error", () => {
		const spawnError = new Error("ENOENT");
		mockSpawnSync.mockReturnValue({
			status: null,
			error: spawnError,
		} as ReturnType<typeof spawnSync>);
		expect(() => run({ scriptKey: "lint", command: "biome lint ." })).toThrow(
			spawnError,
		);
	});

	it("uses pnpm when npm_execpath contains pnpm", () => {
		process.env["npm_execpath"] =
			"/usr/local/lib/node_modules/pnpm/bin/pnpm.cjs";
		mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as ReturnType<
			typeof spawnSync
		>);
		run({ scriptKey: "build", command: "tsc" });
		expect(mockSpawnSync).toHaveBeenCalledWith(
			"pnpm",
			["run", "build"],
			expect.anything(),
		);
	});
});
