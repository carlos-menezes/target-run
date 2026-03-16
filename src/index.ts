// Public programmatic API
export { dispatch, type DispatcherOptions } from "./dispatcher.js";
export {
	resolveScript,
	type ResolveScriptParams,
	type ResolveScriptResult,
} from "./resolve-script.js";
export { createDetector, defaultDetector, type Detector } from "./detect.js";
export {
	DispatcherError,
	PackageJsonError,
	ScriptNotFoundError,
	LifecycleEventError,
	CircularDispatchError,
} from "./errors.js";
