import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveHexProjectDirectories } from "../../src/config/hex-projects";

describe("hex task projects", () => {
    let root: string;

    const write = (rel: string, content: string): void => {
        mkdirSync(join(root, rel, ".."), { recursive: true });
        writeFileSync(join(root, rel), content);
    };

    beforeEach(() => {
        root = realpathSync(mkdtempSync(join(tmpdir(), "vis-hex-tasks-")));
    });

    afterEach(() => {
        rmSync(root, { force: true, recursive: true });
    });

    it("returns the umbrella's apps, skipping claimed directories", () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule R.MixProject do\n  def project do\n    [apps_path: \"apps\"]\n  end\nend\n");
        write("apps/a/mix.exs", "");
        write("apps/b/mix.exs", "");
        write("apps/c/readme.md", "");

        expect(resolveHexProjectDirectories(root, [])).toStrictEqual(["apps/a", "apps/b"]);
        expect(resolveHexProjectDirectories(root, ["apps/a"])).toStrictEqual(["apps/b"]);
    });

    it("returns nothing for a root that is not an umbrella", () => {
        expect.hasAssertions();

        write("mix.exs", "defmodule R.MixProject do\n  def project do\n    [app: :r, version: \"1.0.0\"]\n  end\nend\n");
        write("lib/x.ex", "");

        expect(resolveHexProjectDirectories(root, [])).toStrictEqual([]);
    });
});
