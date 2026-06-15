import { describe, expect, it } from "vitest";

import { NpmAdapter } from "../../../src/release/core/package-managers/npm";
import { MockRunner } from "../../../src/release/core/shell-runner";
import { PrivateVersionActions } from "../../../src/release/core/version-actions/private";
import type { PlannedRelease, WorkspacePackage } from "../../../src/release/types";

const mkRelease = (name: string, newVersion: string): PlannedRelease => {
    return {
        changeFiles: [],
        isCascadeBump: false,
        isDependencyBump: false,
        isGroupBump: false,
        name,
        newVersion,
        oldVersion: "1.0.0",
        reasons: ["EXPLICIT"],
        sources: [],
        type: "minor",
    };
};

const mkPkg = (name: string, version: string, isPrivate: boolean): WorkspacePackage => {
    return {
        dir: `/r/packages/${name}`,
        manifest: { name, version, ...(isPrivate ? { private: true } : {}) },
        manifestPath: `/r/packages/${name}/package.json`,
        name,
        private: isPrivate,
    };
};

describe(PrivateVersionActions, () => {
    it("readPublishedVersion always returns undefined", async () => {
        const actions = new PrivateVersionActions();
        const pm = new NpmAdapter(new MockRunner());

        const result = await actions.readPublishedVersion({
            pkg: mkPkg("@s/private-pkg", "1.0.0", true),
            pm,
        });

        expect(result).toBeUndefined();
    });

    it("publish returns published: false with diagnostic output", async () => {
        const actions = new PrivateVersionActions();
        const pm = new NpmAdapter(new MockRunner());

        const result = await actions.publish({
            catalogs: { default: {}, named: {} },
            pkg: mkPkg("@s/p", "1.0.0", true),
            pm,
            release: mkRelease("@s/p", "1.1.0"),
            versionedManifestByName: new Map(),
        });

        expect(result.published).toBe(false);
        expect(result.output).toContain("[private] skipped publish");
        expect(result.output).toContain("@s/p@1.1.0");
    });

    it("has stable id `private`", () => {
        expect(new PrivateVersionActions().id).toBe("private");
    });
});
