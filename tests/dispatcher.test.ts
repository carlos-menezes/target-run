import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatch } from "../src/dispatcher.js";

vi.mock("node:fs", () => ({
	default: {
		existsSync: vi.fn(() => true),
		readFileSync: vi.fn(),
	},
}));

import fs from "node:fs";

const mockReadFileSync = vi.mocked(fs.readFileSync);

const detector = {
	getPlatform: () => "linux" as const,
	getArch: () => "x64" as const,
};

const mockExit = vi
	.spyOn(process, "exit")
	.mockImplementation((() => undefined) as never);

afterEach(() => {
	vi.clearAllMocks();
	delete process.env["npm_lifecycle_event"];
});

describe("dispatch — level 5 (lifecycle hook self-reference)", () => {
	beforeEach(() => {
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ scripts: { build: "target-run" } }),
		);
		process.env["npm_lifecycle_event"] = "build";
	});

	it("exits 0 silently without --required", () => {
		dispatch({ detector });
		expect(mockExit).toHaveBeenCalledWith(0);
	});

	it("with --verbose, logs the skip reason", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		dispatch({ detector, verbose: true });
		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("skipping silently"),
		);
		expect(mockExit).toHaveBeenCalledWith(0);
	});

	it("with --required, treats it as a hard failure (exit 1)", () => {
		dispatch({ detector, required: true });
		expect(mockExit).toHaveBeenCalledWith(1);
	});
});

describe("dispatch — level 6 (no match at all)", () => {
	beforeEach(() => {
		mockReadFileSync.mockReturnValue(
			JSON.stringify({ scripts: { build: "some-other-tool" } }),
		);
		process.env["npm_lifecycle_event"] = "build";
	});

	it("exits 1 and prints error detail", () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		dispatch({ detector });
		expect(mockExit).toHaveBeenCalledWith(1);
		expect(spy).toHaveBeenCalledWith(
			expect.stringContaining("No matching script found"),
		);
	});

	it("with --optional, exits 0 silently instead", () => {
		dispatch({ detector, optional: true });
		expect(mockExit).toHaveBeenCalledWith(0);
	});

	it("with --required and --optional, --optional wins (exit 0)", () => {
		dispatch({ detector, optional: true, required: true });
		expect(mockExit).toHaveBeenCalledWith(0);
	});
});
