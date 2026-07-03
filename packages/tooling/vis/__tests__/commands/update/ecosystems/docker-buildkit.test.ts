import { writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { scanDockerRepository } from "../../../../src/commands/update/ecosystems/docker/scanner";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

describe("docker scanner — BuildKit FROM flags", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-docker-buildkit-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("captures the image past a leading --platform flag", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "Dockerfile"), "FROM --platform=$BUILDPLATFORM node:18 AS build\n");

        const refs = scanDockerRepository(workspaceRoot);
        const node = refs.find((r) => r.name === "node");

        expect(node).toBeDefined();
        expect(node?.tag).toBe("18");
    });

    it("captures the image past multiple BuildKit flags", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "Dockerfile"), "FROM --platform=linux/amd64 --chown=node:node node:20\n");

        const refs = scanDockerRepository(workspaceRoot);

        expect(refs.find((r) => r.name === "node")?.tag).toBe("20");
    });

    it("does not treat the BuildKit flag itself as an image", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "Dockerfile"), "FROM --platform=linux/amd64 node:20\n");

        const refs = scanDockerRepository(workspaceRoot);

        // Only the real image (node) should appear — not "--platform=linux/amd64".
        expect(refs).toHaveLength(1);
    });
});

describe("docker scanner — inline ignore directive", () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-docker-ignore-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("treats `# vis-update-ignore-next-line` on a FROM line as an inline (this-line) ignore", () => {
        expect.assertions(2);

        writeFileSync(join(workspaceRoot, "Dockerfile"), ["FROM node:18 # vis-update-ignore-next-line", "FROM postgres:14", ""].join("\n"));

        const refs = scanDockerRepository(workspaceRoot);
        const node = refs.find((r) => r.name === "node");
        const postgres = refs.find((r) => r.name === "postgres");

        // The FROM with the inline directive must still be recorded (so
        // the report shows it as ignored), and the postgres line must
        // NOT inherit the ignore.
        expect(node?.ignoreReason).toBeDefined();
        expect(postgres?.ignoreReason).toBeUndefined();
    });

    it("treats `# vis-update-ignore-next-line` on a comment-only line as a lookahead", () => {
        expect.assertions(1);

        writeFileSync(join(workspaceRoot, "Dockerfile"), ["# vis-update-ignore-next-line", "FROM postgres:14", ""].join("\n"));

        const refs = scanDockerRepository(workspaceRoot);

        expect(refs.find((r) => r.name === "postgres")?.ignoreReason).toBeDefined();
    });
});
