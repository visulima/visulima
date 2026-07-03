import { describe, expect, it, vi } from "vitest";

import type { Toolbox } from "../../src";
import { Cerebro as Cli } from "../../src";

const FAILED_TO_LOAD_RE = /Failed to load command "build"/;
const ENOENT_RE = /ENOENT: missing module/;
const MUST_DEFINE_RE = /must define either "execute" or "loader"/;
const CANNOT_DEFINE_BOTH_RE = /cannot define both "execute" and "loader"/;

describe("lazy commands", () => {
    it("does not call the loader at registration", () => {
        expect.assertions(1);

        const loader = vi.fn();

        const cli = new Cli("MyCLI", { argv: ["build"] });

        cli.addCommand({
            description: "Build the project",
            loader,
            name: "build",
        });

        expect(loader).not.toHaveBeenCalled();
    });

    it("does not call the loader when rendering help", async () => {
        expect.assertions(1);

        const loader = vi.fn();

        const cli = new Cli("MyCLI", { argv: ["help"] });

        cli.addCommand({
            description: "Build the project",
            loader,
            name: "build",
        });

        await cli.run({ shouldExitProcess: false });

        expect(loader).not.toHaveBeenCalled();
    });

    it("loads and runs the default export when the command is invoked", async () => {
        expect.assertions(3);

        const handler = vi.fn().mockResolvedValue(undefined);
        const loader = vi.fn().mockResolvedValue({ default: handler });

        const cli = new Cli("MyCLI", { argv: ["build"] });

        cli.addCommand({
            description: "Build the project",
            loader,
            name: "build",
        });

        await cli.run({ shouldExitProcess: false });

        expect(loader).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(expect.any(Object));
    });

    it("caches the resolved handler so the loader runs only once across invocations", async () => {
        expect.assertions(2);

        const handler = vi.fn().mockResolvedValue(undefined);
        const loader = vi.fn().mockResolvedValue({ default: handler });

        const cli = new Cli("MyCLI");

        cli.addCommand({
            description: "Build the project",
            loader,
            name: "build",
        });

        await cli.runCommand("build");
        await cli.runCommand("build");

        expect(loader).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(2);
    });

    it("passes parsed options through to the lazy handler", async () => {
        expect.assertions(1);

        const handler = vi.fn();
        const loader = vi.fn().mockResolvedValue({ default: handler });

        const cli = new Cli("MyCLI", { argv: ["build", "--output", "dist"] });

        cli.addCommand({
            loader,
            name: "build",
            options: [{ name: "output", type: String }],
        });

        await cli.run({ shouldExitProcess: false });

        const toolbox = handler.mock.calls[0]?.[0] as Toolbox;

        expect(toolbox.options.output).toBe("dist");
    });

    it("throws CommandLoaderError when the loaded module has no default export", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["build"] });

        cli.addCommand({
            loader: () => Promise.resolve({}) as Promise<{ default: () => void }>,
            name: "build",
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(FAILED_TO_LOAD_RE);
    });

    it("throws CommandLoaderError when the loader rejects", async () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI", { argv: ["build"] });

        cli.addCommand({
            loader: () => Promise.reject(new Error("ENOENT: missing module")),
            name: "build",
        });

        await expect(cli.run({ shouldExitProcess: false })).rejects.toThrow(ENOENT_RE);
    });

    it("rejects commands that define neither execute nor loader", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        expect(() => cli.addCommand({ name: "build" })).toThrow(MUST_DEFINE_RE);
    });

    it("rejects commands that define both execute and loader", () => {
        expect.assertions(1);

        const cli = new Cli("MyCLI");

        expect(() =>
            cli.addCommand({
                execute: vi.fn(),
                loader: vi.fn(),
                name: "build",
            }),
        ).toThrow(CANNOT_DEFINE_BOTH_RE);
    });

    it("supports nested lazy commands", async () => {
        expect.assertions(2);

        const handler = vi.fn();
        const loader = vi.fn().mockResolvedValue({ default: handler });

        const cli = new Cli("MyCLI", { argv: ["db", "migrate", "up"] });

        cli.addCommand({
            commandPath: ["db", "migrate"],
            description: "Run database migrations",
            loader,
            name: "up",
        });

        await cli.run({ shouldExitProcess: false });

        expect(loader).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("runs a lazy command set as the default command when no argv is given", async () => {
        expect.assertions(2);

        const handler = vi.fn();
        const loader = vi.fn().mockResolvedValue({ default: handler });

        const cli = new Cli("MyCLI", { argv: [] });

        cli.addCommand({
            description: "Default action",
            loader,
            name: "start",
        });

        cli.setDefaultCommand("start");

        await cli.run({ shouldExitProcess: false });

        expect(loader).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
