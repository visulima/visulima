import { describe, expect, it } from "vitest";

import { CargoVersionActions } from "../../../src/release/core/version-actions/cargo";
import { ComposerVersionActions } from "../../../src/release/core/version-actions/composer";
import { ContainerActions } from "../../../src/release/core/version-actions/container";
import { DartVersionActions } from "../../../src/release/core/version-actions/dart";
import { GemVersionActions } from "../../../src/release/core/version-actions/gem";
import { GoVersionActions } from "../../../src/release/core/version-actions/go";
import { GradleVersionActions } from "../../../src/release/core/version-actions/gradle";
import { HexVersionActions } from "../../../src/release/core/version-actions/hex";
import { JsrVersionActions } from "../../../src/release/core/version-actions/jsr";
import { MavenVersionActions } from "../../../src/release/core/version-actions/maven";
import { NativeAddonVersionActions } from "../../../src/release/core/version-actions/native-addon";
import { NpmVersionActions } from "../../../src/release/core/version-actions/npm";
import { NuGetVersionActions } from "../../../src/release/core/version-actions/nuget";
import { PrivateVersionActions } from "../../../src/release/core/version-actions/private";
import { PythonVersionActions } from "../../../src/release/core/version-actions/python";
import { createVersionActions } from "../../../src/release/core/version-actions/registry";
import { ShellPublishActions } from "../../../src/release/core/version-actions/shell";
import { SwiftVersionActions } from "../../../src/release/core/version-actions/swift";
import { ZigVersionActions } from "../../../src/release/core/version-actions/zig";

describe(createVersionActions, () => {
    it.each([
        ["cargo", CargoVersionActions],
        ["composer", ComposerVersionActions],
        ["container", ContainerActions],
        ["dart", DartVersionActions],
        ["gem", GemVersionActions],
        ["go", GoVersionActions],
        ["gradle", GradleVersionActions],
        ["hex", HexVersionActions],
        ["jsr", JsrVersionActions],
        ["maven", MavenVersionActions],
        ["native-addon", NativeAddonVersionActions],
        ["nuget", NuGetVersionActions],
        ["private", PrivateVersionActions],
        ["python", PythonVersionActions],
        ["shell", ShellPublishActions],
        ["swift", SwiftVersionActions],
        ["zig", ZigVersionActions],
    ])("maps the %s id to its implementation", (id, expected) => {
        expect.hasAssertions();

        expect(createVersionActions(id)).toBeInstanceOf(expected);
    });

    it("falls back to npm for an unknown id", () => {
        expect.hasAssertions();

        expect(createVersionActions("not-a-real-id")).toBeInstanceOf(NpmVersionActions);
    });

    it("returns a fresh instance per call", () => {
        expect.hasAssertions();

        expect(createVersionActions("zig")).not.toBe(createVersionActions("zig"));
    });
});
