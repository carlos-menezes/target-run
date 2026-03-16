import os from "node:os";

export type Detector = {
	getPlatform: () => string;
	getArch: () => string;
};

type OsModule = Pick<typeof os, "platform" | "arch">;

/**
 * Creates a Detector from any object that exposes platform() and arch().
 *
 * @example
 * // production
 * import { defaultDetector } from "./detect.js";
 *
 * @example
 * // test
 * const detector = createDetector({ platform: () => "win32", arch: () => "x64" });
 */
export const createDetector = (osModule: OsModule): Detector => ({
	getPlatform: () => osModule.platform(),
	getArch: () => osModule.arch(),
});

export const defaultDetector: Detector = createDetector(os);
