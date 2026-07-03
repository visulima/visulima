/**
 * `private` versionActions — for `package.json#private: true` packages.
 * Versions are bumped on disk (so internal-dep ranges of dependents
 * resolve correctly) but no tarball is packed, no publish is attempted.
 *
 * Optionally creates a git tag if `release.privatePackages.tag` is true.
 */

import type { WorkspacePackage } from "../../types";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";
import type { PublishContext } from "./interface";
import { VersionActions } from "./interface";

export class PrivateVersionActions extends VersionActions {
    public readonly id = "private" as const;

    public async readPublishedVersion(_context: { pkg: WorkspacePackage; pm: PackageManagerAdapter }): Promise<string | undefined> {
        // Private packages are never published; there's no "last published" concept.
        return undefined;
    }

    public async publish(context: PublishContext): Promise<PublishResult> {
        return {
            output: `[private] skipped publish for ${context.pkg.name}@${context.release.newVersion}`,
            published: false,
        };
    }
}
