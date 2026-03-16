import os from "node:os";
import { describe, expect, it } from "vitest";
import { createDetector, defaultDetector } from "../src/detect.js";

describe("createDetector", () => {
	it("returns platform and arch from the provided os module", () => {
		const detector = createDetector({
			platform: () => "win32",
			arch: () => "x64",
		});
		expect(detector.getPlatform()).toBe("win32");
		expect(detector.getArch()).toBe("x64");
	});
});

describe("defaultDetector", () => {
	it("returns the current process platform and arch", () => {
		expect(defaultDetector.getPlatform()).toBe(os.platform());
		expect(defaultDetector.getArch()).toBe(os.arch());
	});
});
