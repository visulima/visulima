import { describe, expect, it } from "vitest";

import { createOrUpdateFloatingTag, renderTagPattern } from "../../../src/release/core/git";
import { MockRunner } from "../../../src/release/core/shell-runner";

describe(renderTagPattern, () => {
    it("substitutes {name} and {version}", () => {
        expect.hasAssertions();
        expect(renderTagPattern("{name}@{version}", { name: "@scope/pkg", version: "1.2.3" })).toBe("@scope/pkg@1.2.3");
    });

    it("supports v-prefix style", () => {
        expect.hasAssertions();
        expect(renderTagPattern("v{version}", { version: "1.2.3" })).toBe("v1.2.3");
    });

    it("supports release-{date} aggregate pattern", () => {
        expect.hasAssertions();

        const out = renderTagPattern("release-{date}", { date: "2026-05-02" });

        expect(out).toBe("release-2026-05-02");
    });

    it("defaults date to today's ISO date when not supplied", () => {
        expect.hasAssertions();

        const out = renderTagPattern("v-{date}", {});
        const today = new Date().toISOString().slice(0, 10);

        expect(out).toBe(`v-${today}`);
    });

    it("supports name-prefix workflows", () => {
        expect.hasAssertions();
        expect(renderTagPattern("{name}-v{version}", { name: "cerebro", version: "3.0.0" })).toBe("cerebro-v3.0.0");
    });

    it("leaves unsubstituted tokens with empty strings (forgiving)", () => {
        expect.hasAssertions();
        expect(renderTagPattern("{name}@{version}", { version: "1.0.0" })).toBe("@1.0.0");
    });

    it("substitutes {unscopedName} stripping the scope", () => {
        expect.hasAssertions();
        expect(renderTagPattern("{unscopedName}@{version}", { name: "@visulima/cerebro", version: "3.0.0" })).toBe("cerebro@3.0.0");
    });

    it("returns name unchanged for {unscopedName} on non-scoped names", () => {
        expect.hasAssertions();
        expect(renderTagPattern("{unscopedName}@{version}", { name: "react", version: "19.0.0" })).toBe("react@19.0.0");
    });

    it("substitutes {major} / {minor} / {patch}", () => {
        expect.hasAssertions();
        expect(renderTagPattern("{major}.{minor}.{patch}", { version: "4.5.6" })).toBe("4.5.6");
    });

    it("substitutes {major} from a prerelease version", () => {
        expect.hasAssertions();
        expect(renderTagPattern("v{major}", { version: "2.0.0-alpha.4" })).toBe("v2");
    });

    it("substitutes {channel}", () => {
        expect.hasAssertions();
        expect(renderTagPattern("release-{channel}-{date}", { channel: "alpha", date: "2026-05-02" })).toBe("release-alpha-2026-05-02");
    });

    it("blanks out {channel} when not provided", () => {
        expect.hasAssertions();
        expect(renderTagPattern("v{version}-{channel}", { version: "1.0.0" })).toBe("v1.0.0-");
    });
});

describe(createOrUpdateFloatingTag, () => {
    interface InvocationLog {
        args: ReadonlyArray<string>;
        command: string;
    }

    const captureInvocations = (runner: MockRunner, sink: InvocationLog[]): void => {
        const original = runner.run.bind(runner);

        runner.run = async (command, args, options) => {
            sink.push({ args: [...args], command });

            return original(command, args, options);
        };
    };

    it("creates the floating tag with `tag -f` and force-pushes the single ref", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);
        runner.on("git", ["tag"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });
        runner.on("git", ["push"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await createOrUpdateFloatingTag({ cwd: "/r", runner }, "v1");

        const tagCall = calls.find((c) => c.command === "git" && c.args[0] === "tag");
        const pushCall = calls.find((c) => c.command === "git" && c.args[0] === "push");

        expect(tagCall).toBeDefined();
        // `-f` forces retarget when the tag already exists (the whole
        // point of a floating major-version tag).
        expect(tagCall!.args).toStrictEqual(["tag", "-f", "v1"]);

        expect(pushCall).toBeDefined();
        expect(pushCall!.args).toContain("--force");
        expect(pushCall!.args).toContain("refs/tags/v1:refs/tags/v1");
    });

    it("skips the push step when push=false", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);
        runner.on("git", ["tag"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });
        runner.on("git", ["push"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await createOrUpdateFloatingTag({ cwd: "/r", runner }, "v1", { push: false });

        const pushCall = calls.find((c) => c.command === "git" && c.args[0] === "push");

        expect(pushCall).toBeUndefined();
    });

    it("propagates signing.mode through to the floating tag", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);
        runner.on("git", ["tag"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });
        runner.on("git", ["push"], () => {
            return { exitCode: 0, stderr: "", stdout: "" };
        });

        await createOrUpdateFloatingTag({ cwd: "/r", runner }, "v1", { signing: { mode: "gpg" } });

        const tagCall = calls.find((c) => c.command === "git" && c.args[0] === "tag");

        expect(tagCall!.args).toStrictEqual(["tag", "-f", "-s", "v1"]);
    });
});
