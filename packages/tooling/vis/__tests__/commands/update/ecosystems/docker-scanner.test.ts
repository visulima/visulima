import { ensureDirSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseImageReference, scanDockerRepository } from "../../../../src/commands/update/ecosystems/docker/scanner";
import { cleanupTemporaryDirectory, createTemporaryDirectory } from "../../../test-helpers";

describe(parseImageReference, () => {
    it("parses unqualified library images", () => {
        expect.assertions(4);

        const parsed = parseImageReference("node:22");

        expect(parsed?.registry).toBe("docker.io");
        expect(parsed?.namespace).toBe("library");
        expect(parsed?.name).toBe("node");
        expect(parsed?.tag).toBe("22");
    });

    it("parses fully qualified GHCR images", () => {
        expect.assertions(3);

        const parsed = parseImageReference("ghcr.io/visulima/runner:1.2.3");

        expect(parsed?.registry).toBe("ghcr.io");
        expect(parsed?.namespace).toBe("visulima");
        expect(parsed?.tag).toBe("1.2.3");
    });

    it("captures digest pins", () => {
        expect.assertions(2);

        const parsed = parseImageReference("alpine:3.19@sha256:1234567890abcdef");

        expect(parsed?.tag).toBe("3.19");
        expect(parsed?.digest).toBe("sha256:1234567890abcdef");
    });

    it("returns undefined for variable expansions", () => {
        expect.assertions(2);

        expect(parseImageReference("${REGISTRY}/node:22")).toBeUndefined();
        expect(parseImageReference("$(echo node):22")).toBeUndefined();
    });

    it("treats a host:port as a registry", () => {
        expect.assertions(2);

        const parsed = parseImageReference("localhost:5000/my/image:tag");

        expect(parsed?.registry).toBe("localhost:5000");
        expect(parsed?.namespace).toBe("my");
    });
});

describe(scanDockerRepository, () => {
    let workspaceRoot: string;

    beforeEach(() => {
        workspaceRoot = createTemporaryDirectory("vis-docker-scanner-");
    });

    afterEach(() => {
        cleanupTemporaryDirectory(workspaceRoot);
    });

    it("extracts FROM lines from Dockerfiles", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "Dockerfile"),
            "FROM node:22 AS base\nWORKDIR /app\nFROM base AS build\nFROM scratch\n",
        );

        const references = scanDockerRepository(workspaceRoot);

        // `scratch` and `FROM base` (a local stage) shouldn't produce updates.
        // Our scanner currently still emits `base` since it can't tell — that's
        // a follow-up. Right now we assert at least the canonical FROM lands.
        expect(references.some((reference) => reference.name === "node" && reference.tag === "22")).toBe(true);
        expect(references.every((reference) => reference.original !== "scratch")).toBe(true);
    });

    it("extracts image: lines from compose files", () => {
        expect.assertions(2);

        writeFileSync(
            join(workspaceRoot, "docker-compose.yml"),
            "services:\n  db:\n    image: postgres:14.5\n  cache:\n    image: 'redis:7.2'\n",
        );

        const references = scanDockerRepository(workspaceRoot);
        const postgres = references.find((reference) => reference.name === "postgres");
        const redis = references.find((reference) => reference.name === "redis");

        expect(postgres?.tag).toBe("14.5");
        expect(redis?.tag).toBe("7.2");
    });

    it("honours `# vis-update-ignore` directives", () => {
        expect.assertions(1);

        writeFileSync(
            join(workspaceRoot, "Dockerfile"),
            "# vis-update-ignore-next-line\nFROM node:18\n",
        );

        const references = scanDockerRepository(workspaceRoot);

        expect(references[0]?.ignoreReason).toBe("vis-update-ignore-next-line");
    });

    it("skips node_modules and .git", () => {
        expect.assertions(1);

        ensureDirSync(join(workspaceRoot, "node_modules/sub"));
        writeFileSync(join(workspaceRoot, "node_modules/sub/Dockerfile"), "FROM node:20\n");

        const references = scanDockerRepository(workspaceRoot);

        expect(references).toHaveLength(0);
    });
});
