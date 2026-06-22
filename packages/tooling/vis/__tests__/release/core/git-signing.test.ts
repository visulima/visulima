/**
 * Tag-signing tests for `createTag` (release-please #1738, #1314).
 *
 * Each test wires a `MockRunner` to a synthetic git binary and asserts
 * the right argv was passed to `git tag` for the four configured modes.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTag, resetGitsignCacheForTests } from "../../../src/release/core/git";
import { MockRunner } from "../../../src/release/core/shell-runner";

interface InvocationLog {
    args: ReadonlyArray<string>;
    command: string;
}

const captureInvocations = (runner: MockRunner, sink: InvocationLog[]): void => {
    // The MockRunner doesn't expose a "see every call" hook, so we wrap
    // the original `run` method on the instance to push every call into
    // the sink. Keeps the test wiring local rather than touching the
    // shared shell-runner module.
    const original = runner.run.bind(runner);

    runner.run = async (command, args, options) => {
        sink.push({ args: [...args], command });

        return original(command, args, options);
    };
};

describe(createTag, () => {
    beforeEach(() => {
        resetGitsignCacheForTests();
    });

    afterEach(() => {
        resetGitsignCacheForTests();
    });

    it("passes -s when signing.mode is `gpg` without an explicit key", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);

        // tagExists + tagExistsRemote both report "no" so we proceed to creation.
        runner.on("git", ["rev-parse", "--verify"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["ls-remote"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["tag"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });

        await createTag(
            { cwd: "/r", runner },
            "pkg@1.0.0",
            "Release pkg@1.0.0",
            { signing: { mode: "gpg" } },
        );

        const tagCall = calls.find((c) => c.command === "git" && c.args[0] === "tag");

        expect(tagCall).toBeDefined();
        expect(tagCall!.args).toStrictEqual(["tag", "-s", "-a", "pkg@1.0.0", "-m", "Release pkg@1.0.0"]);
    });

    it("passes -u <key> when signing.mode is `gpg` with an explicit key", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);

        runner.on("git", ["rev-parse", "--verify"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["ls-remote"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["tag"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });

        await createTag(
            { cwd: "/r", runner },
            "pkg@1.0.0",
            "msg",
            { signing: { key: "ABCD1234", mode: "gpg" } },
        );

        const tagCall = calls.find((c) => c.command === "git" && c.args[0] === "tag");

        expect(tagCall).toBeDefined();
        expect(tagCall!.args).toStrictEqual(["tag", "-u", "ABCD1234", "-a", "pkg@1.0.0", "-m", "msg"]);
    });

    it("passes -s when signing.mode is `ssh` (relies on git config gpg.format=ssh)", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);

        runner.on("git", ["rev-parse", "--verify"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["ls-remote"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["tag"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });

        await createTag(
            { cwd: "/r", runner },
            "pkg@1.0.0",
            "msg",
            { signing: { mode: "ssh" } },
        );

        const tagCall = calls.find((c) => c.command === "git" && c.args[0] === "tag");

        // ssh mode is just `-s` from git's CLI perspective. The
        // operator is responsible for `git config gpg.format ssh` +
        // `user.signingkey`. The doctor surfaces missing config at
        // preflight; the create path stays simple.
        expect(tagCall).toBeDefined();
        expect(tagCall!.args).toStrictEqual(["tag", "-s", "-a", "pkg@1.0.0", "-m", "msg"]);
    });

    it("falls back to GPG with a warning when signing.mode is `sigstore` and gitsign is missing", async () => {
        expect.hasAssertions();

        const runner = new MockRunner();
        const calls: InvocationLog[] = [];

        captureInvocations(runner, calls);

        runner.on("git", ["rev-parse", "--verify"], () => { return { exitCode: 1, stderr: "", stdout: "" }; });
        runner.on("git", ["ls-remote"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        runner.on("git", ["tag"], () => { return { exitCode: 0, stderr: "", stdout: "" }; });
        // gitsign is missing → --version exits non-zero.
        runner.on("gitsign", ["--version"], () => { return { exitCode: 127, stderr: "command not found", stdout: "" }; });

        const originalStderrWrite = process.stderr.write.bind(process.stderr);
        const stderrCaptured: string[] = [];

        process.stderr.write = ((chunk: string | Uint8Array) => {
            stderrCaptured.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));

            return true;
        });

        try {
            await createTag(
                { cwd: "/r", runner },
                "pkg@1.0.0",
                "msg",
                { signing: { mode: "sigstore" } },
            );
        } finally {
            process.stderr.write = originalStderrWrite;
        }

        // The warning was printed to stderr.
        expect(stderrCaptured.join("")).toContain("sigstore");
        expect(stderrCaptured.join("")).toContain("gitsign");

        // And the git tag invocation used the GPG `-s` fallback path.
        const tagCall = calls.find((c) => c.command === "git" && c.args[0] === "tag");

        expect(tagCall).toBeDefined();
        expect(tagCall!.args).toContain("-s");
    });
});
