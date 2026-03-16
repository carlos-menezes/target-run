import { describe, expect, it } from "vitest";
import { resolveScript } from "../src/resolver.js";

const base = "build";
const platform = "linux";
const arch = "x64";

describe("resolveScript", () => {
	it("resolves exact platform:arch match (level 1)", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: { "build:linux:x64": "tsc --platform" },
		});
		expect(result).toMatchObject({
			key: "build:linux:x64",
			command: "tsc --platform",
		});
	});

	it("resolves platform-only match (level 2) when no exact match", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: { "build:linux": "tsc --linux" },
		});
		expect(result).toMatchObject({
			key: "build:linux",
			command: "tsc --linux",
		});
	});

	it("resolves arch-only match (level 3) when no platform match", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: { "build:x64": "tsc --x64" },
		});
		expect(result).toMatchObject({ key: "build:x64", command: "tsc --x64" });
	});

	it("resolves default match (level 4) when no platform or arch match", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: { "build:default": "tsc" },
		});
		expect(result).toMatchObject({ key: "build:default", command: "tsc" });
	});

	it("prefers more specific match over less specific", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: {
				"build:linux:x64": "exact",
				"build:linux": "platform",
				"build:x64": "arch",
				"build:default": "default",
			},
		});
		expect(result.key).toBe("build:linux:x64");
	});

	it("prefers platform over arch when exact match is absent", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: {
				"build:linux": "platform",
				"build:x64": "arch",
				"build:default": "default",
			},
		});
		expect(result.key).toBe("build:linux");
	});

	it("returns skipped=true when base script is 'target-run' and no variant matches (level 5)", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: { [base]: "target-run" },
		});
		expect(result).toMatchObject({ key: null, command: null, skipped: true });
	});

	it("returns key/command null without skipped when no match and base is not self-referencing", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: {},
		});
		expect(result).toMatchObject({ key: null, command: null });
		expect(result.skipped).toBeUndefined();
	});

	it("includes all candidates in tried regardless of outcome", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: {},
		});
		expect(result.tried).toEqual([
			"build:linux:x64",
			"build:linux",
			"build:x64",
			"build:default",
		]);
	});

	it("tried stops at the matched key", () => {
		const result = resolveScript({
			base,
			platform,
			arch,
			scripts: { "build:linux": "tsc" },
		});
		expect(result.tried).toEqual(["build:linux:x64", "build:linux"]);
	});
});
