import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { detectFrameworks, getFrameworkEnvVariables, inferFrameworkEnvPatterns } from "../../src/framework-inference";

const createTemporaryDirectory = async (): Promise<string> => {
    // eslint-disable-next-line sonarjs/pseudo-random
    const directory = join(tmpdir(), `fw-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    await mkdir(directory, { recursive: true });

    return directory;
};

describe(detectFrameworks, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("should detect Next.js", async () => {
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["NEXT_PUBLIC_"]);
    });

    it("should detect Vite", async () => {
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["VITE_"]);
    });

    it("should detect Create React App", async () => {
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["REACT_APP_"]);
    });

    it("should detect multiple frameworks", async () => {
        expect.assertions(3);

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
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["GATSBY_"]);
    });

    it("should detect Nuxt", async () => {
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["NUXT_PUBLIC_"]);
    });

    it("should detect Expo", async () => {
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["EXPO_PUBLIC_"]);
    });

    it("should detect Remix", async () => {
        expect.assertions(2);

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
        expect.assertions(3);

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
        expect(frameworks[0]?.envPrefixes).toStrictEqual(["PUBLIC_"]);
    });

    it("should return empty array for no frameworks", async () => {
        expect.assertions(1);

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
        expect.assertions(1);

        const frameworks = await detectFrameworks(join(workspaceRoot, "nonexistent.json"));

        expect(frameworks).toHaveLength(0);
    });
});

describe(inferFrameworkEnvPatterns, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("should infer patterns across multiple projects", async () => {
        expect.assertions(2);

        await mkdir(join(workspaceRoot, "packages/web"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/admin"), { recursive: true });

        await writeFile(join(workspaceRoot, "packages/web/package.json"), JSON.stringify({ dependencies: { next: "14.0.0" } }));

        await writeFile(join(workspaceRoot, "packages/admin/package.json"), JSON.stringify({ devDependencies: { vite: "5.0.0" } }));

        const patterns = await inferFrameworkEnvPatterns(workspaceRoot, {
            admin: { root: "packages/admin" },
            web: { root: "packages/web" },
        });

        expect(patterns).toContain("NEXT_PUBLIC_*");
        expect(patterns).toContain("VITE_*");
    });

    it("should deduplicate prefixes", async () => {
        expect.assertions(1);

        await mkdir(join(workspaceRoot, "packages/web1"), { recursive: true });
        await mkdir(join(workspaceRoot, "packages/web2"), { recursive: true });

        await writeFile(join(workspaceRoot, "packages/web1/package.json"), JSON.stringify({ dependencies: { next: "14.0.0" } }));

        await writeFile(join(workspaceRoot, "packages/web2/package.json"), JSON.stringify({ dependencies: { next: "13.0.0" } }));

        const patterns = await inferFrameworkEnvPatterns(workspaceRoot, {
            web1: { root: "packages/web1" },
            web2: { root: "packages/web2" },
        });

        // Should only have one NEXT_PUBLIC_* pattern, not two
        const nextPublicCount = patterns.filter((p) => p === "NEXT_PUBLIC_*").length;

        expect(nextPublicCount).toBe(1);
    });
});

describe(getFrameworkEnvVariables, () => {
    let workspaceRoot: string;

    beforeEach(async () => {
        workspaceRoot = await createTemporaryDirectory();
    });

    afterEach(async () => {
        await rm(workspaceRoot, { force: true, recursive: true });
    });

    it("should return matching framework env vars", async () => {
        expect.assertions(1);

        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(packageJsonPath, JSON.stringify({ dependencies: { next: "14.0.0" } }));

        const env = {
            NEXT_PUBLIC_ANALYTICS_ID: "abc123",
            NEXT_PUBLIC_API_URL: "https://api.example.com",
            PATH: "/usr/bin",
            SECRET_KEY: "secret",
        };

        const result = await getFrameworkEnvVariables(packageJsonPath, env);

        expect(result).toStrictEqual({
            NEXT_PUBLIC_ANALYTICS_ID: "abc123",
            NEXT_PUBLIC_API_URL: "https://api.example.com",
        });
    });

    it("should return empty for no matching env vars", async () => {
        expect.assertions(1);

        const packageJsonPath = join(workspaceRoot, "package.json");

        await writeFile(packageJsonPath, JSON.stringify({ dependencies: { next: "14.0.0" } }));

        const env = {
            PATH: "/usr/bin",
            SECRET_KEY: "secret",
        };

        const result = await getFrameworkEnvVariables(packageJsonPath, env);

        expect(result).toStrictEqual({});
    });

    it("should handle multiple framework prefixes", async () => {
        expect.assertions(1);

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
            OTHER_VAR: "ignored",
            VITE_APP_TITLE: "My App",
        };

        const result = await getFrameworkEnvVariables(packageJsonPath, env);

        expect(result).toStrictEqual({
            NEXT_PUBLIC_API: "https://api.example.com",
            VITE_APP_TITLE: "My App",
        });
    });
});
