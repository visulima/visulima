// Some of this code is taken from https://github.com/chalk/supports-color/blob/main/index.js
// MIT License
// Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

import { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
import type { ColorSupportLevel } from "./types";

/**
 * @param stdName The standard name of the stream, either "err" or "out".
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const isColorSupportedFactory = (stdName: "err" | "out"): ColorSupportLevel => {
    // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-explicit-any, no-underscore-dangle
    const _this = globalThis as any;

    // eslint-disable-next-line eqeqeq
    const isDeno = _this.Deno != undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proc: Record<string, any> = _this.process ?? _this.Deno ?? {};
    // Node -> `argv`, Deno -> `args`
    const argv: string[] = (proc.argv ?? proc.args ?? []) as string[];

    /**
     * Detect whether flags exist with `-` or `--` prefix in command-line arguments.
     * @param regex The RegEx to match all possible flags.
     * @returns
     */
    const oneOfFlags = (regex: RegExp): boolean => {
        const terminatorPosition = argv.indexOf("--");

        const position = argv.findIndex((flag) => regex.test(flag));

        return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
    };

    let environment: Record<string, string | undefined> = {};

    try {
        // Deno requires the permission for the access to env, use the `--allow-env` flag: deno run --allow-env ./app.js

        environment = isDeno ? proc.env.toObject() : proc.env ?? {};
    } catch {
        // Deno: if interactive permission is not granted, do nothing, no colors
    }

    const FORCE_COLOR = "FORCE_COLOR";
    const hasForceColor = FORCE_COLOR in environment;
    const forceColorValue = environment[FORCE_COLOR] ? String(environment[FORCE_COLOR]) : undefined;
    const forceColorValueIsString = Object.prototype.toString.call(forceColorValue).slice(8, -1) === "String";

    let forceColor: ColorSupportLevel | undefined;

    if (forceColorValue === "true") {
        forceColor = SPACE_16_COLORS;
    } else if (forceColorValue === "false") {
        forceColor = SPACE_MONO;
    } else if (forceColorValueIsString && (forceColorValue as string).length === 0) {
        forceColor = SPACE_16_COLORS;
    } else if (forceColorValueIsString && (forceColorValue as string).length > 0) {
        forceColor = Math.min(Number.parseInt(forceColorValue as string, 10), 3) as ColorSupportLevel;
    }

    if (forceColorValue !== "true" && forceColorValue !== "false" && forceColor !== undefined && forceColor < 4) {
        return forceColor;
    }

    const isForceDisabled
        // eslint-disable-next-line regexp/no-unused-capturing-group
        = "NO_COLOR" in environment || (hasForceColor && forceColor === 0) || oneOfFlags(/^-{1,2}(no-color|no-colors|color=false|color=never)$/);

    if (isForceDisabled) {
        return SPACE_MONO;
    }

    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (oneOfFlags(/^-{1,2}(color=256)$/)) {
        return SPACE_256_COLORS;
    }

    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (oneOfFlags(/^-{1,2}(color=16m|color=full|color=truecolor)$/)) {
        return SPACE_TRUE_COLORS;
    }

    // eslint-disable-next-line regexp/no-unused-capturing-group
    const isForceEnabled = oneOfFlags(/^-{1,2}(color|colors|color=true|color=always)$/);

    if (isForceEnabled) {
        return SPACE_16_COLORS;
    }

    // note: the order of checks is important
    // many terminals that support truecolor have TERM as `xterm-256colors` but do not set COLORTERM to `truecolor`
    // therefore they can be detected by specific EVN variables

    const minColorLevel = forceColor || SPACE_MONO;

    // Check for Azure DevOps pipelines.
    // Has to be above the `stream isTTY` check.
    if ("TF_BUILD" in environment && "AGENT_NAME" in environment) {
        return SPACE_16_COLORS;
    }

    const isDumbTerminal: boolean = (environment.TERM && /-mono|dumb/i.test(environment.TERM)) as boolean;

    if (isDumbTerminal) {
        return minColorLevel;
    }

    if ((isDeno ? _this.Deno.build.os : proc.platform) === "win32") {
        try {
            // Deno requires the permission for the access to the operating system, use the `--allow-sys` flag: deno run --allow-sys ./app.js

            // Windows 10 build 10586 is the first Windows release that supports 256 colors.
            // Windows 10 build 14931 is the first release that supports 16m/TrueColor.

            const osRelease = (isDeno ? _this.Deno.osRelease() : proc.os.release()).split(".");

            if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10_586) {
                return Number(osRelease[2]) >= 14_931 ? SPACE_TRUE_COLORS : SPACE_256_COLORS;
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
        // eslint-disable-next-line regexp/no-unused-capturing-group
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(environment.TEAMCITY_VERSION as string) ? SPACE_16_COLORS : SPACE_MONO;
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
        const version = Number.parseInt(((environment.TERM_PROGRAM_VERSION as string) ?? "").split(".")[0] as string, 10);

        if (environment.TERM_PROGRAM === "iTerm.app") {
            return version >= 3 ? SPACE_TRUE_COLORS : SPACE_256_COLORS;
        }

        if (environment.TERM_PROGRAM === "Apple_Terminal") {
            return SPACE_256_COLORS;
        }
    }

    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (/-256(color)?$/i.test(<string>environment.TERM)) {
        return SPACE_256_COLORS;
    }

    let isTTY = false;

    if (isDeno) {
        if (stdName === "out") {
            isTTY = _this.Deno.stdout.isTerminal();
        } else if (stdName === "err") {
            isTTY = _this.Deno.stderr.isTerminal();
        }
    } else if ("PM2_HOME" in environment && "pm_id" in environment) {
        // PM2 does not set process.stdout.isTTY, but colors may be supported (depends on actual terminal)
        isTTY = true;
    } else {
        isTTY = proc[`std${stdName}`] && "isTTY" in proc[`std${stdName}`];
    }

    if (isTTY && /^screen|^tmux|^xterm|^vt[1-5]\d\d|^ansi|color|mintty|rxvt|cygwin|linux/i.test(<string>environment.TERM)) {
        return SPACE_16_COLORS;
    }

    if ("COLORTERM" in environment) {
        return SPACE_16_COLORS;
    }

    return minColorLevel;
};

export const isStdoutColorSupported = (): ColorSupportLevel => isColorSupportedFactory("out");

export const isStderrColorSupported = (): ColorSupportLevel => isColorSupportedFactory("err");

export { SPACE_16_COLORS, SPACE_256_COLORS, SPACE_MONO, SPACE_TRUE_COLORS } from "./color-spaces";
export type { ColorSupportLevel } from "./types";
