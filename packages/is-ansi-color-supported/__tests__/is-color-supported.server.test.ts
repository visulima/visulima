import { describe, expect, it } from "vitest";

import { isColorSupported } from "../src/is-color-supported.server";

describe("node.JS isColorSupported", () => {
    it(`process undefined`, () => {
        expect.assertions(1);

        // save original `process` object
        const processOriginal = process;

        // eslint-disable-next-line no-global-assign
        process = undefined;

        const received = isColorSupported(undefined);

        expect(received).toBe(0);

        // restore original `process` object
        // eslint-disable-next-line no-global-assign
        process = processOriginal;
    });

    it(`should process undefined mock`, () => {
        expect.assertions(1);

        const received = isColorSupported(undefined);

        expect(received).toBeGreaterThan(0);
    });

    it(`should process {} Mock`, () => {
        expect.assertions(1);

        const received = isColorSupported({});

        expect(received).toBe(0);
    });

    it(`should return 0 in only CI is in env`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { CI: "GITLAB_CI" },
                platform: "linux",
            },
        });

        expect(received).toBe(0);
    });

    it.each(["TRAVIS", "CIRCLECI", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"])(`should return 1 if "%s" is in env`, (ci) => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { CI: ci, [ci]: "1" },
                platform: "linux",
            },
        });

        expect(received).toBe(1);
    });

    it.each(["GITHUB_ACTIONS", "GITHUB_WORKFLOW", "GITEA_ACTIONS"])(`should return 3 if "%s" is in env`, (ci) => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { CI: ci, [ci]: "1" },
                platform: "linux",
            },
        });

        expect(received).toBe(3);
    });

    it(`should return 1 if Codeship is in env`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { CI: true, CI_NAME: "codeship" },
                platform: "linux",
            },
        });

        expect(received).toBe(1);
    });

    it(`should process no colors, unsupported terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "dumb" },
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(0);
    });

    it(`should process no colors, simulate output in file > log.txt`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "xterm" },
            },
        });

        expect(received).toBe(0);
    });

    it(`should enable colors via --color`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color"],
                env: {},
                platform: "linux",
            },
        });

        expect(received).toBe(1);
    });

    it(`should enable colors via -color`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["-color"],
                env: {},
                platform: "linux",
            },
        });

        expect(received).toBe(1);
    });

    it(`should enable colors via --color=true`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color=true"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should enable colors via -color=true`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["-color=true"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should disable colors via --color=false`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color=false"],
                env: { TERM: "xterm" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(0);
    });

    it(`should enable colors via --color=256`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color=256"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(2);
    });

    it(`should enable colors via --color=16m`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color=16m"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(3);
    });

    it(`should enable colors via --color=full`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color=full"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(3);
    });

    it(`should enable colors via --color=truecolor`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color=truecolor"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(3);
    });

    it(`should ignore post-terminator flags`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: ["--color", "--", "--no-color"],
                env: { TERM: "dumb" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should disable colors via NO_COLOR=1`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { NO_COLOR: "1", TERM: "xterm" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(0);
    });

    it(`should disable colors via FORCE_COLOR=0`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "0", TERM: "xterm" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(0);
    });

    it(`should disable colors via FORCE_COLOR=false`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "false", TERM: "xterm" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(0);
    });

    it(`should enable colors via FORCE_COLOR=1`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "1" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should enable colors via FORCE_COLOR=2`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "2" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(2);
    });

    it(`should enable colors via FORCE_COLOR=3`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "3" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(3);
    });

    it(`should enable colors via FORCE_COLOR=true`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "true" },
                platform: "linux",
            },
        });

        expect(received).toBe(1);
    });

    it(`should maxes out the FORCE_COLOR value of 3`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { FORCE_COLOR: "4" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(3);
    });

    it(`should enable colors via FORCE_COLOR=true, but honor 256`, () => {
        expect.assertions(2);

        expect(
            isColorSupported({
                process: {
                    argv: ["--color=256"],
                    env: { FORCE_COLOR: "true" },
                    platform: "linux",
                },
            }),
        ).toBe(2);

        expect(
            isColorSupported({
                process: {
                    argv: ["--color=256"],
                    env: { FORCE_COLOR: "1" },
                    platform: "linux",
                },
            }),
        ).toBe(2);
    });

    it("should return 0 if `TEAMCITY_VERSION` is in env and is < 9.1", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TEAMCITY_VERSION: "9.0.5 (build 32523)" },
                    platform: "linux",
                },
            }),
        ).toBe(0);
    });

    it("should return level 1 if `TEAMCITY_VERSION` is in env and is >= 9.1", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TEAMCITY_VERSION: "9.1.0 (build 32523)" },
                    platform: "linux",
                },
            }),
        ).toBe(1);
    });

    it("should support rxvt", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TERM: "rxvt" },
                    platform: "linux",
                    stderr: { isTTY: true },
                    stdout: { isTTY: true },
                },
            }),
        ).toBe(1);
    });

    it("return 1 if `COLORTERM` is in env", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { COLORTERM: "true" },
                    platform: "linux",
                },
            }),
        ).toBe(1);
    });

    it("should prefer level 2/xterm over COLORTERM", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { COLORTERM: "1", TERM: "xterm-256color" },
                    platform: "linux",
                },
            }),
        ).toBe(2);
    });

    it("should support screen-256color", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TERM: "screen-256color" },
                    platform: "linux",
                },
            }),
        ).toBe(2);
    });

    it("should support putty-256color", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TERM: "putty-256color" },
                    platform: "linux",
                },
            }),
        ).toBe(2);
    });

    it("should level should be 3 when using iTerm 3.0", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: {
                        TERM_PROGRAM: "iTerm.app",
                        TERM_PROGRAM_VERSION: "3.0.10",
                    },
                    platform: "darwin",
                },
            }),
        ).toBe(3);
    });

    it("should level should be 2 when using iTerm 2.9", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: {
                        TERM_PROGRAM: "iTerm.app",
                        TERM_PROGRAM_VERSION: "2.9.3",
                    },
                    platform: "darwin",
                },
            }),
        ).toBe(2);
    });

    it("should return level 1 if on Windows earlier than 10 build 10586", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: {},
                    os: {
                        release: () => "10.0.10240",
                    },
                    platform: "win32",
                    versions: "8.0.0",
                },
            }),
        ).toBe(1);
    });

    it("should return level 2 if on Windows 10 build 10586 or later", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: {},
                    os: {
                        release: () => "10.0.10586",
                    },
                    platform: "win32",
                    versions: "8.0.0",
                },
            }),
        ).toBe(2);
    });

    it("should return level 3 if on Windows 10 build 14931 or later", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: {},
                    os: {
                        release: () => "10.0.14931",
                    },
                    platform: "win32",
                    versions: "8.0.0",
                },
            }),
        ).toBe(3);
    });

    it("should return level 2 when FORCE_COLOR is set when not TTY in xterm256", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { FORCE_COLOR: "true", TERM: "xterm-256color" },
                    platform: "linux",
                    stderr: { isTTY: false },
                    stdout: { isTTY: false },
                },
            }),
        ).toBe(2);
    });

    it("should return false when `TERM` is set to dumb", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TERM: "dumb" },
                    platform: "linux",
                },
            }),
        ).toBe(0);
    });

    it("should return false when `TERM` is set to dumb when `TERM_PROGRAM` is set", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TERM: "dumb", TERM_PROGRAM: "Apple_Terminal" },
                    platform: "linux",
                },
            }),
        ).toBe(0);
    });

    it("should return false when `TERM` is set to dumb when run on Windows", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { TERM: "dumb", TERM_PROGRAM: "Apple_Terminal" },
                    os: {
                        release: () => "10.0.14931",
                    },
                    platform: "win32",
                    versions: "10.13.0",
                },
            }),
        ).toBe(0);
    });

    it("return level 1 when `TERM` is set to dumb when `FORCE_COLOR` is set", () => {
        expect.assertions(1);

        expect(
            isColorSupported({
                process: {
                    argv: [],
                    env: { FORCE_COLOR: "1", TERM: "dumb" },
                    platform: "linux",
                },
            }),
        ).toBe(1);
    });
});

// Deno
describe("deno isColorSupported", () => {
    it(`should support env TERM`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            Deno: {
                args: [],
                build: {
                    os: "linux", // win32
                },
                env: {
                    toObject: () => {
                        return { TERM: "xterm-256color" };
                    },
                },
                isatty: (rid) => rid === 1, // analog to process.stdout.isTTY in node
            },
        });

        expect(received).toBe(2);
    });

    it(`should support deno platform win`, () => {
        expect.assertions(2);

        expect(
            isColorSupported({
                Deno: {
                    args: [],
                    build: {
                        os: "win32",
                    },
                    env: {
                        toObject: () => {
                            return { TERM: "" };
                        },
                    },
                    isatty: () => false, // analog to process.stdout.isTTY in node
                    osRelease: () => "10.0.14931",
                },
            }),
        ).toBe(3);

        expect(
            isColorSupported({
                Deno: {
                    args: [],
                    build: {
                        os: "win32",
                    },
                    env: {
                        toObject: () => {
                            return { TERM: "" };
                        },
                    },
                    isatty: () => false, // analog to process.stdout.isTTY in node
                    osRelease: () => "9.0.14931",
                },
            }),
        ).toBe(1);
    });

    it(`should support FORCE_COLOR`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            Deno: {
                args: [],
                build: {
                    os: "linux",
                },
                env: {
                    toObject: () => {
                        return { FORCE_COLOR: 1 };
                    },
                },
                isatty: () => false, // analog to process.stdout.isTTY in node
            },
        });

        expect(received).toBe(1);
    });

    it(`flag '--color'`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            Deno: {
                args: ["--color"],
                build: {
                    os: "linux",
                },
                env: {
                    toObject: () => {
                        return {};
                    },
                },
                isatty: () => false, // analog to process.stdout.isTTY in node
            },
        });

        expect(received).toBe(1);
    });
});

describe("next.js isColorSupported", () => {
    it(`should support color on runtime experimental-edge`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { NEXT_RUNTIME: "experimental-edge", TERM: "xterm-256color" },
                platform: "linux",
            },
        });

        expect(received).toBe(2);
    });

    it(`should support color on runtime edge`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { NEXT_RUNTIME: "edge", TERM: "xterm-256color" },
                platform: "linux",
            },
        });

        expect(received).toBe(2);
    });

    it(`should support color on runtime nodejs`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { NEXT_RUNTIME: "nodejs", TERM: "xterm-256color" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(2);
    });
});

describe("support colors in terminals", () => {
    it(`should support xterm terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "xterm" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should support vt220 terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "vt220" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should support vt320-w terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "vt320-w" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should support vt525 terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "vt525" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should support tmux terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "tmux" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should support mintty-direct terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "mintty-direct" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });

    it(`should support ansi.sysk terminal`, () => {
        expect.assertions(1);

        const received = isColorSupported({
            process: {
                argv: [],
                env: { TERM: "ansi.sysk" },
                platform: "linux",
                stderr: { isTTY: true },
                stdout: { isTTY: true },
            },
        });

        expect(received).toBe(1);
    });
});
