// Public programmatic API

export { createDetector, type Detector, defaultDetector } from "./detector.js";
export { type DispatcherOptions, dispatch } from "./dispatcher.js";
export {
	CircularDispatchError,
	DispatcherError,
	LifecycleEventError,
	PackageJsonError,
	ScriptNotFoundError,
} from "./errors.js";
export {
	type ResolveScriptParams,
	type ResolveScriptResult,
	resolveScript,
} from "./resolver.js";
