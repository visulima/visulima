import type { ColorSupportLevel } from "./types";

/**
 * @param {Object?} mockThis The mock object of globalThis, used by unit test only.
 * @returns {boolean}
 */
// eslint-disable-next-line sonarjs/cognitive-complexity,@typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
export const isColorSupported = (mockThis?: any): ColorSupportLevel => {
    // eslint-disable-next-line @typescript-eslint/naming-convention,@typescript-eslint/no-unsafe-assignment,no-underscore-dangle
    const _this = mockThis ?? globalThis;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isDeno = _this.Deno != null;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-explicit-any
    const proc: Record<string, any> = _this.process ?? _this.Deno ?? {};

    // Node -> `argv`, Deno -> `args`
    const argv: string[] = (proc["argv"] ?? proc["args"] ?? []) as string[];

    /**
     * Detect whether flags exist with `-` or `--` prefix in command-line arguments.
     *
     * @param {RegExp} regex The RegEx to match all possible flags.
     * @return {boolean}
     */
    const oneOfFlags = (regex: RegExp): boolean => argv.some((value) => regex.test(value));

    let environment: Record<string, string | undefined> = {};

    try {
        // Deno requires the permission for the access to env, use the `--allow-env` flag: deno run --allow-env ./app.js
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        environment = isDeno ? proc["env"].toObject() : proc["env"] ?? {};
    } catch {
        // Deno: if interactive permission is not granted, do nothing, no colors
    }

    const FORCE_COLOR = "FORCE_COLOR";
    const hasForceColor = FORCE_COLOR in environment;
    // eslint-disable-next-line security/detect-object-injection
    const forceColorValue = environment[FORCE_COLOR] ?? "";
    const forceColor = forceColorValue === "true" || Number.parseInt(forceColorValue, 10) > 0;

    // eslint-disable-next-line regexp/no-unused-capturing-group
    const isForceDisabled = "NO_COLOR" in environment || (hasForceColor && !forceColor) || oneOfFlags(/^-{1,2}(no-color|color=false|color=never)$/);

    if (isForceDisabled) {
        return 0;
    }

    // eslint-disable-next-line regexp/no-unused-capturing-group
    const isForceEnabled = (hasForceColor && forceColor) || oneOfFlags(/^-{1,2}(color|color=true|color=always)$/);

    if (isForceEnabled) {
        return 1;
    }

    // Check for Azure DevOps pipelines.
    // Has to be above the `stream isTTY` check.
    if ("TF_BUILD" in environment && "AGENT_NAME" in environment) {
        return 1;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
    const isTTY = isDeno ? _this.Deno.isatty(1) : proc["stdout"] && "isTTY" in proc["stdout"];

    // when Next.JS runtime is `edge`, process.stdout is undefined, but colors output is supported
    // runtime values supported colors: `nodejs`, `edge`, `experimental-edge`
    const isNextJS = (environment["NEXT_RUNTIME"] ?? "").includes("edge");

    if (!isTTY && !isNextJS) {
        return 0;
    }

    const isDumbTerminal: boolean = environment["TERM"] === "dumb";

    if (isDumbTerminal) {
        return 0;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if ((isDeno ? _this.Deno.build.os : proc["platform"]) === "win32") {
        try {
            // Deno requires the permission for the access to the operating system, use the `--allow-sys` flag: deno run --allow-sys ./app.js

            // Windows 10 build 10586 is the first Windows release that supports 256 colors.
            // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
            const osRelease = (isDeno ? _this.Deno.osRelease() : proc["os"].release()).split(".");

            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            if (Number(osRelease[0]) >= 10 && Number(osRelease[2]) >= 10_586) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                return Number(osRelease[2]) >= 14_931 ? 3 : 2;
            }

            return 1;
        } catch {
            // Deno: if interactive permission is not granted, do nothing, no colors
        }
    }

    if ("CI" in environment) {
        if ("GITHUB_ACTIONS" in environment || "GITEA_ACTIONS" in environment) {
            return 3;
        }

        if (
            ["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"].some((sign) => sign in environment) ||
            environment["CI_NAME"] === "codeship"
        ) {
            return 1;
        }

        return 0;
    }

    if ("TEAMCITY_VERSION" in environment) {
        // https://www.jetbrains.com/help/teamcity/build-script-interaction-with-teamcity.html#BuildScriptInteractionwithTeamCity-ReportingMessages
        // eslint-disable-next-line regexp/no-unused-capturing-group
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(environment["TEAMCITY_VERSION"] as string) ? 1 : 0;
    }

    if (environment["COLORTERM"] === "truecolor") {
        return 3;
    }

    if (environment["TERM"] === "xterm-kitty") {
        return 3;
    }

    if ("TERM_PROGRAM" in environment) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        const version = Number.parseInt(((environment["TERM_PROGRAM_VERSION"] as string) ?? "").split(".")[0] as string, 10);

        if (environment["TERM_PROGRAM"] === "iTerm.app") {
            return version >= 3 ? 3 : 2;
        }

        if (environment["TERM_PROGRAM"] === "Apple_Terminal") {
            return 2;
        }
    }

    // eslint-disable-next-line regexp/no-unused-capturing-group
    if (/-256(color)?$/i.test(<string>environment["TERM"])) {
        return 2;
    }

    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(<string>environment["TERM"])) {
        return 1;
    }

    if ("COLORTERM" in environment) {
        return 1;
    }

    return 0;
};
