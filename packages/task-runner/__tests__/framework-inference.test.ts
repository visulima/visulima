import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
    detectFrameworks,
    inferFrameworkEnvPatterns,
    getFrameworkEnvVars,
} from "../src/framework-inference";

const createTmpDir = async (): Promise<string> => {
    const dir = join(tmpdir(), `fw-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(dir, { recursive: true });

    return dir;
};

describe("detectFrameworks", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    it("should detect Next.js", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { next: "14.0.0", react: "18.2.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Next.js");
        expect(frameworks[0]?.envPrefixes).toEqual(["NEXT_PUBLIC_"]);
    });

    it("should detect Vite", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                devDependencies: { vite: "5.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Vite");
        expect(frameworks[0]?.envPrefixes).toEqual(["VITE_"]);
    });

    it("should detect Create React App", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { "react-scripts": "5.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Create React App");
        expect(frameworks[0]?.envPrefixes).toEqual(["REACT_APP_"]);
    });

    it("should detect multiple frameworks", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { next: "14.0.0" },
                devDependencies: { vite: "5.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(2);

        const names = frameworks.map((f) => f.name);

        expect(names).toContain("Next.js");
        expect(names).toContain("Vite");
    });

    it("should detect Gatsby", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { gatsby: "5.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Gatsby");
        expect(frameworks[0]?.envPrefixes).toEqual(["GATSBY_"]);
    });

    it("should detect Nuxt", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { nuxt: "3.9.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Nuxt");
        expect(frameworks[0]?.envPrefixes).toEqual(["NUXT_PUBLIC_"]);
    });

    it("should detect Expo", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { expo: "50.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Expo");
        expect(frameworks[0]?.envPrefixes).toEqual(["EXPO_PUBLIC_"]);
    });

    it("should detect Remix", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { "@remix-run/react": "2.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("Remix");
    });

    it("should detect SvelteKit", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                devDependencies: { "@sveltejs/kit": "2.0.0" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(1);
        expect(frameworks[0]?.name).toBe("SvelteKit");
        expect(frameworks[0]?.envPrefixes).toEqual(["PUBLIC_"]);
    });

    it("should return empty array for no frameworks", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { lodash: "4.17.21" },
            }),
        );

        const frameworks = await detectFrameworks(packageJsonPath);

        expect(frameworks).toHaveLength(0);
    });

    it("should return empty array for missing package.json", async () => {
        const frameworks = await detectFrameworks(join(workspaceRoot, "nonexistent.json"));

        expect(frameworks).toHaveLength(0);
    });
});

describe("inferFrameworkEnvPatterns", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    it("should infer patterns across multiple projects", async () => {
        await mkdir(join(workspaceRoot, "packages/web"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/admin"), { recursive: true });

        await writeFile(
            join(workspaceRoot, "packages/web/package.json"),
            JSON.stringify({ dependencies: { next: "14.0.0" } }),
        );

        await writeFile(
            join(workspaceRoot, "packages/admin/package.json"),
            JSON.stringify({ devDependencies: { vite: "5.0.0" } }),
        );

        const patterns = await inferFrameworkEnvPatterns(workspaceRoot, {
            web: { root: "packages/web" },
            admin: { root: "packages/admin" },
        });

        expect(patterns).toContain("NEXT_PUBLIC_*");
        expect(patterns).toContain("VITE_*");
    });

    it("should deduplicate prefixes", async () => {
        await mkdir(join(workspaceRoot, "packages/web1"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/web2"), { recursive: true });

        await writeFile(
            join(workspaceRoot, "packages/web1/package.json"),
            JSON.stringify({ dependencies: { next: "14.0.0" } }),
        );

        await writeFile(
            join(workspaceRoot, "packages/web2/package.json"),
            JSON.stringify({ dependencies: { next: "13.0.0" } }),
        );

        const patterns = await inferFrameworkEnvPatterns(workspaceRoot, {
            web1: { root: "packages/web1" },
            web2: { root: "packages/web2" },
        });

        // Should only have one NEXT_PUBLIC_* pattern, not two
        const nextPublicCount = patterns.filter((p) => p === "NEXT_PUBLIC_*").length;

        expect(nextPublicCount).toBe(1);
    });
});

describe("getFrameworkEnvVars", () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTmpDir();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { recursive: true, force: true });
    });

    it("should return matching framework env vars", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({ dependencies: { next: "14.0.0" } }),
        );

        const env = {
            NEXT_PUBLIC_API_URL: "https://api.example.com",
            NEXT_PUBLIC_ANALYTICS_ID: "abc123",
            SECRET_KEY: "secret",
            PATH: "/usr/bin",
        };

        const result = await getFrameworkEnvVars(packageJsonPath, env);

        expect(result).toEqual({
            NEXT_PUBLIC_API_URL: "https://api.example.com",
            NEXT_PUBLIC_ANALYTICS_ID: "abc123",
        });
    });

    it("should return empty for no matching env vars", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({ dependencies: { next: "14.0.0" } }),
        );

        const env = {
            SECRET_KEY: "secret",
            PATH: "/usr/bin",
        };

        const result = await getFrameworkEnvVars(packageJsonPath, env);

        expect(result).toEqual({});
    });

    it("should handle multiple framework prefixes", async () => {
        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(
            packageJsonPath,
            JSON.stringify({
                dependencies: { next: "14.0.0" },
                devDependencies: { vite: "5.0.0" },
            }),
        );

        const env = {
            NEXT_PUBLIC_API: "https://api.example.com",
            VITE_APP_TITLE: "My App",
            OTHER_VAR: "ignored",
        };

        const result = await getFrameworkEnvVars(packageJsonPath, env);

        expect(result).toEqual({
            NEXT_PUBLIC_API: "https://api.example.com",
            VITE_APP_TITLE: "My App",
        });
    });
});
