// Native NAPI binding loader.
//
// The napi-generated `index.js` at the package root handles platform-binding
// selection via the `@visulima/secret-scanner-binding-*` optionalDependencies.
// `loadNativeRootBinding` requires it from the package root, walking up so the
// reference survives however a bundler (Vite, packem, Rollup) nests this module
// under dist/.

import type * as Native from "../index.js";
import loadNativeRootBinding from "./load-native-root-binding";

export const binding = loadNativeRootBinding(import.meta.url) as typeof Native;

export type * as Native from "../index.js";
