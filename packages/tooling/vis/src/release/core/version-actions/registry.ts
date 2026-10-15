/**
 * Canonical version-actions factory.
 *
 * Maps a `versionActions` id (resolved by `resolveVersionActionsId` in
 * `workspace.ts`) to its concrete {@link VersionActions} implementation.
 *
 * This is the single source of truth for the dispatch — previously the same
 * `switch` was copy-pasted into `orchestrator.ts`, `version-resolver.ts` and
 * the doctor handler, and the copies had already diverged (some omitted
 * `container`/`maven`/…). A new id only needs to be wired up here.
 *
 * The module imports only the leaf action classes (which depend on
 * `interface.ts`/`types.ts`, never on the orchestrator), so importing it from
 * the orchestrator or resolver does not create a circular dependency.
 */
import { CargoVersionActions } from "./cargo";
import { ComposerVersionActions } from "./composer";
import { ContainerActions } from "./container";
import { DartVersionActions } from "./dart";
import { GemVersionActions } from "./gem";
import { GoVersionActions } from "./go";
import { GradleVersionActions } from "./gradle";
import { HexVersionActions } from "./hex";
import type { VersionActions } from "./interface";
import { MavenVersionActions } from "./maven";
import { NativeAddonVersionActions } from "./native-addon";
import { NpmVersionActions } from "./npm";
import { NuGetVersionActions } from "./nuget";
import { PrivateVersionActions } from "./private";
import { PythonVersionActions } from "./python";
import { ShellPublishActions } from "./shell";
import { SwiftVersionActions } from "./swift";
import { ZigVersionActions } from "./zig";

/**
 * Construct the {@link VersionActions} implementation for a resolved id.
 *
 * Unknown ids fall back to npm — the historical default and the only safe
 * choice for a JS workspace package without explicit configuration.
 * @param id versionActions id (e.g. `npm`, `cargo`, `container`).
 * @returns a fresh {@link VersionActions} instance.
 */
export const createVersionActions = (id: string): VersionActions => {
    switch (id) {
        case "cargo": {
            return new CargoVersionActions();
        }
        case "composer": {
            return new ComposerVersionActions();
        }
        case "container": {
            return new ContainerActions();
        }
        case "dart": {
            return new DartVersionActions();
        }
        case "gem": {
            return new GemVersionActions();
        }

        case "go": {
            return new GoVersionActions();
        }
        case "gradle": {
            return new GradleVersionActions();
        }
        case "hex": {
            return new HexVersionActions();
        }
        case "maven": {
            return new MavenVersionActions();
        }
        case "native-addon": {
            return new NativeAddonVersionActions();
        }
        case "nuget": {
            return new NuGetVersionActions();
        }
        case "private": {
            return new PrivateVersionActions();
        }
        case "python": {
            return new PythonVersionActions();
        }
        case "shell": {
            return new ShellPublishActions();
        }
        case "swift": {
            return new SwiftVersionActions();
        }
        case "zig": {
            return new ZigVersionActions();
        }
        default: {
            return new NpmVersionActions();
        }
    }
};
