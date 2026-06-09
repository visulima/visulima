import { defineConfig } from "@visulima/vis/config";

// Secure defaults are applied automatically by defineConfig().
// You only need to add allowBuilds for packages with build scripts.
// Run 'vis check --security-config' to see all active settings.
export default defineConfig({
    security: {
        allowBuilds: {
            // "esbuild": true,
        },
    },
    release: {
        baseBranch: "main",
        defaultManaged: true,
        channels: {
            main: { tag: "latest", mode: "version-pr" },
            next: { tag: "next", mode: "version-pr" },
            alpha: { tag: "alpha", prerelease: "alpha", mode: "auto-publish" },
            beta: { tag: "beta", prerelease: "beta", mode: "auto-publish" },
            "[0-9]*.x": { tag: "branch-name", range: "match", mode: "version-pr" },
            "[0-9]*.[0-9]*.x": { tag: "branch-name", range: "match", mode: "version-pr" },
        },
        publish: {
            packManager: "pnpm",
            publishStrategy: "npm-publish-tarball",
            publishArgs: ["--provenance"],
            protocolResolution: "pack",
            catalogResolution: "auto",
            cleanPackageJson: true,
        },
        gitUser: {
            name: "release-bot",
            email: "release-bot@anolilab.de",
        },
        signing: { mode: "sigstore" },
        floatingMajorTag: false,
    },
});
