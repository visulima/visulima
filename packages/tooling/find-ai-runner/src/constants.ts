import { platform } from "node:os";

import type { AiProviderName } from "./types";

/** Regex to extract a semver version string from CLI `--version` output. */
// eslint-disable-next-line sonarjs/slow-regex -- bounded input from CLI --version output
export const VERSION_REGEX: RegExp = /v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/;

/** Timeout in ms for `which`/`where` detection commands. */
export const DETECTION_TIMEOUT = 5000;

/** Timeout in ms for `--version` commands. */
export const VERSION_TIMEOUT = 10_000;

/** Default timeout in ms for running a prompt (5 minutes). */
export const DEFAULT_RUN_TIMEOUT = 300_000;

/** Default max tokens for AI responses. */
export const DEFAULT_MAX_TOKENS = 4096;

/** Whether the current platform is Windows. */
export const IS_WINDOWS: boolean = platform() === "win32";

/** All supported provider names in alphabetical order. */
export const PROVIDER_NAMES: AiProviderName[] = ["amp", "claude", "codex", "copilot", "crush", "cursor", "droid", "gemini", "kimi", "opencode", "qwen"];
