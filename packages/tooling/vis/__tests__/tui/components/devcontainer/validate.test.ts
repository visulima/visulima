import { describe, expect, it } from "vitest";

import type { DevcontainerConfig } from "../../../../src/tui/components/devcontainer/types";
import { validateConfig } from "../../../../src/tui/components/devcontainer/validate";

describe(validateConfig, () => {
    describe("errors", () => {
        it("should require image, build, or dockerComposeFile", () => {
            expect.assertions(2);

            const result = validateConfig({ name: "test" });

            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(expect.objectContaining({ field: "image" }));
        });

        it("should pass when image is set", () => {
            expect.assertions(1);

            const result = validateConfig({ image: "ubuntu:latest", name: "test" });

            expect(result.valid).toBe(true);
        });

        it("should pass when build is set with dockerfile", () => {
            expect.assertions(1);

            const result = validateConfig({
                build: { dockerfile: "Dockerfile" },
                name: "test",
            });

            expect(result.valid).toBe(true);
        });

        it("should pass when dockerComposeFile + service is set", () => {
            expect.assertions(1);

            const result = validateConfig({
                dockerComposeFile: "docker-compose.yml",
                name: "test",
                service: "app",
            });

            expect(result.valid).toBe(true);
        });

        it("should error when build is missing dockerfile", () => {
            expect.assertions(2);

            const result = validateConfig({ build: {}, name: "test" });

            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(expect.objectContaining({ field: "build.dockerfile" }));
        });

        it("should error when dockerComposeFile is set without service", () => {
            expect.assertions(2);

            const result = validateConfig({
                dockerComposeFile: "docker-compose.yml",
                name: "test",
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toContainEqual(expect.objectContaining({ field: "service" }));
        });

        it("should error on invalid port range", () => {
            expect.assertions(2);

            const result = validateConfig({
                forwardPorts: [0, 99_999],
                image: "ubuntu",
                name: "test",
            });

            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(2);
        });

        it("should accept valid port numbers", () => {
            expect.assertions(1);

            const result = validateConfig({
                forwardPorts: [3000, 8080, 5432],
                image: "ubuntu",
                name: "test",
            });

            expect(result.errors.filter((e) => e.field === "forwardPorts")).toHaveLength(0);
        });
    });

    describe("warnings", () => {
        it("should warn when both image and build are set", () => {
            expect.assertions(1);

            const result = validateConfig({
                build: { dockerfile: "Dockerfile" },
                image: "ubuntu",
                name: "test",
            });

            expect(result.warnings).toContainEqual(expect.objectContaining({ field: "image" }));
        });

        it("should warn about privileged mode", () => {
            expect.assertions(1);

            const result = validateConfig({
                image: "ubuntu",
                name: "test",
                privileged: true,
            });

            expect(result.warnings).toContainEqual(expect.objectContaining({ field: "privileged" }));
        });

        it("should not warn about privileged when false", () => {
            expect.assertions(1);

            const result = validateConfig({
                image: "ubuntu",
                name: "test",
                privileged: false,
            });

            expect(result.warnings.filter((w) => w.field === "privileged")).toHaveLength(0);
        });
    });

    describe("suggestions", () => {
        it("should suggest adding a name when missing", () => {
            expect.assertions(1);

            const result = validateConfig({ image: "ubuntu" });

            expect(result.suggestions).toContainEqual(expect.objectContaining({ field: "name" }));
        });

        it("should suggest adding features when empty", () => {
            expect.assertions(1);

            const result = validateConfig({ image: "ubuntu", name: "test" });

            expect(result.suggestions).toContainEqual(expect.objectContaining({ field: "features" }));
        });

        it("should suggest adding extensions when empty", () => {
            expect.assertions(1);

            const result = validateConfig({ image: "ubuntu", name: "test" });

            expect(result.suggestions).toContainEqual(expect.objectContaining({ field: "extensions" }));
        });

        it("should not suggest features when features are present", () => {
            expect.assertions(1);

            const result = validateConfig({
                features: { "ghcr.io/devcontainers/features/node:1": {} },
                image: "ubuntu",
                name: "test",
            });

            expect(result.suggestions.filter((s) => s.field === "features")).toHaveLength(0);
        });

        it("should not suggest extensions when extensions are present", () => {
            expect.assertions(1);

            const result = validateConfig({
                customizations: { vscode: { extensions: ["dbaeumer.vscode-eslint"] } },
                image: "ubuntu",
                name: "test",
            });

            expect(result.suggestions.filter((s) => s.field === "extensions")).toHaveLength(0);
        });
    });

    describe("complete config", () => {
        it("should return valid with no errors for a well-formed config", () => {
            expect.assertions(3);

            const config: DevcontainerConfig = {
                customizations: { vscode: { extensions: ["dbaeumer.vscode-eslint"] } },
                features: { "ghcr.io/devcontainers/features/node:1": {} },
                forwardPorts: [3000],
                image: "mcr.microsoft.com/devcontainers/javascript-node:22",
                name: "Node.js Dev",
                postCreateCommand: "npm install",
                remoteUser: "node",
            };

            const result = validateConfig(config);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.warnings).toHaveLength(0);
        });
    });
});
