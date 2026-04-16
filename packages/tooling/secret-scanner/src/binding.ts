// Native NAPI binding loader.
//
// The napi-generated `index.js` at the package root is CJS and handles
// platform-binding selection via the `@visulima/secret-scanner-binding-*`
// optionalDependencies. We load it with `createRequire` so any bundler
// (Vite, packem, Rollup) leaves the reference intact instead of trying to
// statically resolve the platform-specific `.node` addon.

import { createRequire } from "node:module";

import type * as Native from "../index.js";

const esmRequire = createRequire(import.meta.url);

export const binding = esmRequire("../index.js") as typeof Native;

export type * as Native from "../index.js";
