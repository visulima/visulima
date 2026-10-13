/**
 * Swift packages for the task graph, opt-in through `swift.discover`. Every
 * directory under the workspace root with a `Package.swift` is a candidate, the
 * same walk the release side uses.
 *
 * The workspace root itself is not a task project, the same as Gradle's build
 * root, because the workspace patterns never name it.
 */

import { readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { findSwiftPackageDirectories, readSwiftPackageName, SWIFT_MANIFEST } from "../util/swift-package";

/** The `Package(name:)` literal of the manifest in `directory`, or undefined when it is missing or not a literal. */
export const readSwiftProjectName = (directory: string): string | undefined => {
    let text: string;

    try {
        text = readFileSync(join(directory, SWIFT_MANIFEST), "utf8");
    } catch {
        return undefined;
    }

    const declared = readSwiftPackageName(text);

    return declared.kind === "literal" ? declared.name : undefined;
};

/** Workspace-relative Swift package directories, skipping the root and anything under a claimed directory. */
export const resolveSwiftProjectDirectories = (workspaceRoot: string, claimed: string[]): string[] =>
    findSwiftPackageDirectories(workspaceRoot)
        .map((directory) => relative(workspaceRoot, directory).split(sep).join("/"))
        .filter(
            (directory) =>
                directory !== "" && !claimed.some((claimedDirectory) => directory === claimedDirectory || directory.startsWith(`${claimedDirectory}/`)),
        );
