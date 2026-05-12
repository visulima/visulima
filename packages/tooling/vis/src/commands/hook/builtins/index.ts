/**
 * Registry of vis-bundled `pre-commit-hooks`-equivalent built-ins.
 *
 * Adding a new builtin: drop a module beside this file that exports
 * `(files, args, logger) => number`, then add an entry below. The map
 * key is the public hook id (matches the upstream pre-commit id where
 * one exists) and is referenced from `HookEntry.builtin` in
 * `.vis-hooks/config.json` as well as from
 * `prek.ts:REMOTE_HOOK_BUILTIN_MAP`.
 */

import { runCheckJson } from "./check-json";
import { runCheckMergeConflict } from "./check-merge-conflict";
import { runEndOfFileFixer } from "./end-of-file-fixer";
import { runMixedLineEnding } from "./mixed-line-ending";
import { runTrailingWhitespace } from "./trailing-whitespace";
import type { BuiltinFunction } from "./types";

const BUILTIN_REGISTRY: Readonly<Record<string, BuiltinFunction>> = {
    "check-json": runCheckJson,
    "check-merge-conflict": runCheckMergeConflict,
    "end-of-file-fixer": runEndOfFileFixer,
    "mixed-line-ending": runMixedLineEnding,
    "trailing-whitespace": runTrailingWhitespace,
};

const BUILTIN_HOOK_IDS: ReadonlyArray<string> = Object.keys(BUILTIN_REGISTRY).sort();

const isBuiltin = (id: string): boolean => Object.hasOwn(BUILTIN_REGISTRY, id);

const getBuiltin = (id: string): BuiltinFunction | undefined => BUILTIN_REGISTRY[id];

export { BUILTIN_HOOK_IDS, BUILTIN_REGISTRY, getBuiltin, isBuiltin };

export { type BuiltinContext, type BuiltinFunction, type BuiltinLogger } from "./types";
