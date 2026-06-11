// Some of this code is taken from https://github.com/chalk/supports-color/blob/main/index.js
// MIT License
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

import { release as osRelease } from "node:os";

import { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
import type { ColorSupportLevel, CreateIsColorSupportedOptions } from "./types";

// eslint-disable-next-line regexp/no-unused-capturing-group
const NO_COLOR_FLAGS_RE = /^-{1,2}(no-color|no-colors|color=false|color=never)$/;
// eslint-disable-next-line regexp/no-unused-capturing-group
const COLOR_256_FLAGS_RE = /^-{1,2}(color=256)$/;
// eslint-disable-next-line regexp/no-unused-capturing-group
const COLOR_TRUECOLOR_FLAGS_RE = /^-{1,2}(color=16m|color=full|color=truecolor)$/;
// eslint-disable-next-line regexp/no-unused-capturing-group
const COLOR_ENABLED_FLAGS_RE = /^-{1,2}(color|colors|color=true|color=always)$/;
const DUMB_TERM_RE = /-mono|dumb/i;
// eslint-disable-next-line regexp/no-unused-capturing-group
const TEAMCITY_RE = /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/;
// eslint-disable-next-line regexp/no-unused-capturing-group
const TERM_256_RE = /-256(color)?$/i;
const TERM_COLOR_RE = /^screen|^tmux|^xterm|^vt[1-5]\d\d|^ansi|color|mintty|rxvt|cygwin|linux/i;

/**
 * Compute the ANSI color-support level for a given standard stream.
 * @param stdName The standard name of the stream, either "err" or "out".
 * @param options Detection options (e.g. disabling CLI flag sniffing or forcing the TTY state).
 * @returns The detected {@link ColorSupportLevel}.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const isColorSupportedFactory = (stdName: "err" | "out", options: CreateIsColorSupportedOptions = {}): ColorSupportLevel => {
    const { isTTY: isTTYOverride, sniffFlags = true } = options;

    // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment, no-underscore-dangle
    const _this = globalThis as any;

    // eslint-disable-next-line eqeqeq,@typescript-eslint/no-unsafe-member-access
    const isDeno = _this.Deno != undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const proc: Record<string, any> = _this.process ?? _this.Deno ?? {};
    // Node -> `argv`, Deno -> `args`
    const argv: string[] = (proc.argv ?? proc.args ?? []) as string[];

    // Cache the `--` terminator lookup; `oneOfFlags` is called several times per detection.
    const terminatorPosition = sniffFlags ? argv.indexOf("--") : -1;

    /**
     * Detect whether flags exist with `-` or `--` prefix in command-line arguments.
     *
     * Returns `false` unconditionally when flag sniffing is disabled, so library
     * consumers whose CLIs define their own `--color` semantics are not affected.
     * @param regex The RegEx to match all possible flags.
     * @returns Whether a matching flag precedes the `--` terminator.
     */
    const oneOfFlags = (regex: RegExp): boolean => {
        if (!sniffFlags) {
            return false;
        }

        const position = argv.findIndex((flag) => regex.test(flag));

        return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };

    let environment: Record<string, string | undefined> = {};

    try {
        // Deno requires the permission for the access to env, use the `--allow-env` flag: deno run --allow-env ./app.js

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        environment = isDeno ? proc.env.toObject() : proc.env ?? {};
    } catch {
        // Deno: if interactive permission is not granted, do nothing, no colors
    }

    const FORCE_COLOR = "FORCE_COLOR";
    const hasForceColor = FORCE_COLOR in environment;
    const forceColorValue = environment[FORCE_COLOR] ?? undefined;
    const forceColorValueIsString = typeof forceColorValue === "string";
    const forceColorValueIsNumber = typeof forceColorValue === "number";

    let forceColor: ColorSupportLevel | undefined;

    if (forceColorValue === "true") {
        forceColor = SPACE_16_COLORS;
    } else if (forceColorValue === "false") {
        forceColor = SPACE_MONO;
    } else if (forceColorValueIsString && forceColorValue.length === 0) {
        forceColor = SPACE_16_COLORS;
    } else if (forceColorValueIsString && forceColorValue.length > 0) {
        const parsed = Number.parseInt(forceColorValue, 10);

        forceColor = Number.isNaN(parsed) ? undefined : (Math.min(parsed, 3) as ColorSupportLevel);
    } else if (forceColorValueIsNumber) {
        // Deno's `env.toObject()` (and other runtimes) can yield a raw numeric FORCE_COLOR value.
        forceColor = Number.isNaN(forceColorValue) ? undefined : (Math.min(forceColorValue, 3) as ColorSupportLevel);
    }

    if (forceColorValue !== "true" && forceColorValue !== "false" && forceColor !== undefined && forceColor < 4) {
        return forceColor;
    }

    // The `--no-color` CLI flag always wins (command-line arguments have the highest priority).
    // For the `NO_COLOR` env variable, `FORCE_COLOR` overrides it whenever it requests color
    // (any value other than `0`/`false`). This keeps `FORCE_COLOR=true NO_COLOR=1` consistent with
    // `FORCE_COLOR=1 NO_COLOR=1` (both enable color), matching the documented
    // "FORCE_COLOR overrides all other color support checks" behaviour.
    const forceColorEnables = hasForceColor && forceColor !== undefined && forceColor > 0;
    const isForceDisabled = (hasForceColor && forceColor === 0) || oneOfFlags(NO_COLOR_FLAGS_RE) || (!forceColorEnables && "NO_COLOR" in environment);

    if (isForceDisabled) {
        return SPACE_MONO;
    }

    if (oneOfFlags(COLOR_256_FLAGS_RE)) {
        return SPACE_256_COLORS;
    }

    if (oneOfFlags(COLOR_TRUECOLOR_FLAGS_RE)) {
        return SPACE_TRUE_COLORS;
    }

    const isForceEnabled = oneOfFlags(COLOR_ENABLED_FLAGS_RE);

    if (isForceEnabled) {
        return SPACE_16_COLORS;
    }

    // note: the order of checks is important
    // many terminals that support truecolor have TERM as `xterm-256colors` but do not set COLORTERM to `truecolor`
    // therefore they can be detected by specific EVN variables

    const minColorLevel = forceColor ?? SPACE_MONO;

    // Check for Azure DevOps pipelines.
    // Has to be above the `stream isTTY` check.
    if ("TF_BUILD" in environment && "AGENT_NAME" in environment) {
        return SPACE_16_COLORS;
    }

    const isDumbTerminal: boolean = (environment.TERM && DUMB_TERM_RE.test(environment.TERM)) as boolean;

    if (isDumbTerminal) {
        return minColorLevel;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if ((isDeno ? _this.Deno.build.os : proc.platform) === "win32") {
        // Modern Windows terminals advertise themselves via env variables even when `TERM`/`COLORTERM`
        // are unset; honor those before falling back to the OS build-number heuristic.
        // - `WT_SESSION` -> Windows Terminal (truecolor)
        // - `ANSICON` -> ANSICON shim (16 colors)
        if ("WT_SESSION" in environment) {
            return SPACE_TRUE_COLORS;
        }

        if ("ANSICON" in environment) {
            return SPACE_16_COLORS;
        }

        try {
            // Deno requires the permission for the access to the operating system, use the `--allow-sys` flag: deno run --allow-sys ./app.js

            // Windows 10 build 10586 is the first Windows release that supports 256 colors.
            // Windows 10 build 14931 is the first release that supports 16m/TrueColor.

            // Prefer a runtime-provided `os.release()` (Deno's `osRelease`, or an injected `process.os`
            // used by tests); otherwise read it from `node:os`. The previous code called `proc.os.release()`
            // which always threw on real Node (`process` has no `os` property), so Windows detection was
            // silently broken and fell through to no color.
            let rawRelease: string;

            if (isDeno) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                rawRelease = _this.Deno.osRelease();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            } else if (typeof proc.os?.release === "function") {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                rawRelease = proc.os.release();
            } else {
                rawRelease = osRelease();
            }

            const release = rawRelease.split(".");

            if (Number(release[0]) >= 10 && Number(release[2]) >= 10_586) {
                return Number(release[2]) >= 14_931 ? SPACE_TRUE_COLORS : SPACE_256_COLORS;
            }

            return SPACE_16_COLORS;
        } catch {
            // Deno: if interactive permission is not granted, do nothing, no colors
        }
    }

    if ("CI" in environment) {
        if (["GITEA_ACTIONS", "CIRCLECI", "GITHUB_WORKFLOW", "GITHUB_ACTIONS"].some((sign) => sign in environment)) {
            return SPACE_TRUE_COLORS;
        }

        if (["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in environment) || environment.CI_NAME === "codeship") {
            return SPACE_16_COLORS;
        }

        return minColorLevel;
    }

    // JetBrains IDEA: JetBrains-JediTerm
    if (environment.TERMINAL_EMULATOR?.includes("JediTerm")) {
        return SPACE_TRUE_COLORS;
    }

    if ("TEAMCITY_VERSION" in environment) {
        // https://www.jetbrains.com/help/teamcity/build-script-interaction-with-teamcity.html#BuildScriptInteractionwithTeamCity-ReportingMessages
        return TEAMCITY_RE.test(environment.TEAMCITY_VERSION as string) ? SPACE_16_COLORS : SPACE_MONO;
    }

    if (environment.COLORTERM === "truecolor") {
        return SPACE_TRUE_COLORS;
    }

    // kitty is GPU based terminal emulator
    if (environment.TERM === "xterm-kitty") {
        return SPACE_TRUE_COLORS;
    }

    if (environment.TERM === "xterm-ghostty") {
        return SPACE_TRUE_COLORS;
    }

    if (environment.TERM === "wezterm") {
        return SPACE_TRUE_COLORS;
    }

    if ("TERM_PROGRAM" in environment) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const version = Number.parseInt(((environment.TERM_PROGRAM_VERSION as string) ?? "").split(".")[0] as string, 10);

        if (environment.TERM_PROGRAM === "iTerm.app") {
            return version >= 3 ? SPACE_TRUE_COLORS : SPACE_256_COLORS;
        }

        if (environment.TERM_PROGRAM === "Apple_Terminal") {
            return SPACE_256_COLORS;
        }
    }

    // Note: this is intentionally evaluated before the `isTTY` gate below (ansis-style behaviour),
    // so a 256-color `TERM` reports level 2 even when piped (e.g. `myapp > log.txt`). This diverges
    // from supports-color's TTY-first behaviour; pass `isTTY: false` to a custom detector if you
    // need stricter gating.
    if (TERM_256_RE.test(<string>environment.TERM)) {
        return SPACE_256_COLORS;
    }

    let isTTY: boolean;

    if (isTTYOverride !== undefined) {
        isTTY = isTTYOverride;
    } else if (isDeno) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        isTTY = stdName === "out" ? _this.Deno.stdout.isTerminal() : _this.Deno.stderr.isTerminal();
    } else if ("PM2_HOME" in environment && "pm_id" in environment) {
        // PM2 does not set process.stdout.isTTY, but colors may be supported (depends on actual terminal)
        isTTY = true;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        isTTY = Boolean(proc[`std${stdName}`]?.isTTY);
    }

    if (isTTY && TERM_COLOR_RE.test(<string>environment.TERM)) {
        return SPACE_16_COLORS;
    }

    if ("COLORTERM" in environment) {
        return SPACE_16_COLORS;
    }

    return minColorLevel;
};

/**
 * Detect the ANSI color-support level of the current process' **stdout** stream.
 *
 * Honors `FORCE_COLOR`/`NO_COLOR`, `--color`/`--no-color`/`--color=256`/`--color=16m` CLI flags,
 * CI providers, `TERM`/`COLORTERM`, terminal emulators and Windows build numbers.
 * @returns The detected {@link ColorSupportLevel} (`0` none, `1` 16-color, `2` 256-color, `3` truecolor).
 */
export const isStdoutColorSupported = (): ColorSupportLevel => isColorSupportedFactory("out");

/**
 * Detect the ANSI color-support level of the current process' **stderr** stream.
 *
 * Useful because stdout and stderr can have different TTY capabilities (e.g. `node app > out.txt`).
 * @returns The detected {@link ColorSupportLevel} (`0` none, `1` 16-color, `2` 256-color, `3` truecolor).
 */
export const isStderrColorSupported = (): ColorSupportLevel => isColorSupportedFactory("err");

/**
 * Create a color-support detector for a specific standard stream with custom options.
 *
 * This is the configurable equivalent of {@link isStdoutColorSupported} /
 * {@link isStderrColorSupported}. It lets library consumers disable CLI flag sniffing
 * (`sniffFlags: false`) when their CLI defines its own `--color` semantics, or force the
 * TTY state (`isTTY`) when probing for a non-standard sink such as a log file.
 * @param stream Which standard stream to probe: `"stdout"` (default) or `"stderr"`.
 * @param options Detection options.
 * @returns The detected {@link ColorSupportLevel}.
 * @example
 * ```ts
 * // Detect stdout color support without inspecting `process.argv`:
 * const level = createIsColorSupported("stdout", { sniffFlags: false });
 * ```
 */
export const createIsColorSupported = (stream: "stderr" | "stdout" = "stdout", options: CreateIsColorSupportedOptions = {}): ColorSupportLevel =>
    isColorSupportedFactory(stream === "stderr" ? "err" : "out", options);

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel, CreateIsColorSupportedOptions } from "./types";
