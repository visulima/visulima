import { describe, expect, it } from "vitest";

import { generateDockerfile } from "../../src/util/dockerfile";

describe("dockerfile generator", () => {
    it("emits a BuildKit, multi-stage skeleton for pnpm", () => {
        expect.assertions(6);

        const out = generateDockerfile({ focus: "@my/app", manager: "pnpm", nodeVersion: "22" });

        expect(out).toContain("# syntax=docker/dockerfile:1");
        expect(out).toContain("FROM node:22-slim AS base");
        expect(out).toContain("FROM base AS deps");
        expect(out).toContain("FROM deps AS build");
        expect(out).toContain("AS runtime");
        // pnpm uses a cache mount + corepack
        expect(out).toContain("--mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile");
    });

    it("uses the focus project in the build command", () => {
        expect.assertions(2);

        expect(generateDockerfile({ focus: "@my/app", manager: "pnpm", nodeVersion: "22" })).toContain("pnpm --filter @my/app build");
        // No focus → generic build
        expect(generateDockerfile({ manager: "pnpm", nodeVersion: "22" })).toContain("RUN pnpm build");
    });

    it("emits the right install/build commands per package manager", () => {
        expect.assertions(8);

        const npm = generateDockerfile({ focus: "app", manager: "npm", nodeVersion: "22" });

        expect(npm).toContain("npm ci");
        expect(npm).toContain("npm run build --workspace app");

        const yarn = generateDockerfile({ focus: "app", manager: "yarn", nodeVersion: "22" });

        expect(yarn).toContain("yarn install --immutable");
        expect(yarn).toContain("yarn workspace app build");

        const bun = generateDockerfile({ focus: "app", manager: "bun", nodeVersion: "22" });

        expect(bun).toContain("bun install --frozen-lockfile");
        expect(bun).toContain("bun run --filter app build");

        const aube = generateDockerfile({ focus: "app", manager: "aube", nodeVersion: "22" });

        expect(aube).toContain("aube install --frozen-lockfile");
        expect(aube).toContain("aube run --filter app build");
    });

    it("honors the node version and runs as a non-root user with a TODO entrypoint", () => {
        expect.assertions(3);

        const out = generateDockerfile({ focus: "app", manager: "pnpm", nodeVersion: "24" });

        expect(out).toContain("FROM node:24-slim AS base");
        expect(out).toContain("USER node");
        expect(out).toContain("# TODO");
    });

    it("wires the prune step into the build stage", () => {
        expect.assertions(1);

        expect(generateDockerfile({ focus: "app", manager: "pnpm", nodeVersion: "22" })).toContain("vis docker prune --context=.vis/docker");
    });
});
