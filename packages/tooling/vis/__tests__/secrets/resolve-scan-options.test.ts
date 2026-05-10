import { describe, expect, it } from "vitest";

import type { SecretsFlags, VisSecretsConfig } from "../../src/commands/secrets/handler";
import { resolveScanOptions } from "../../src/commands/secrets/handler";

const NO_FLAGS: SecretsFlags = {};
const ROOT = "/workspace";

describe("resolveScanOptions presets shorthand", () => {
    it("expands `config.presets` to `tag:preset:<name>` enable filters", () => {
        expect.assertions(1);

        const cfg: VisSecretsConfig = { config: { presets: ["exposed-files", "weak-passwords"] } };

        const opts = resolveScanOptions(NO_FLAGS, cfg, ROOT);

        expect(opts.rules?.enable).toStrictEqual(["tag:preset:exposed-files", "tag:preset:weak-passwords"]);
    });

    it("merges presets after `rules.enable` so explicit user entries keep their slot", () => {
        expect.assertions(1);

        const cfg: VisSecretsConfig = {
            config: { presets: ["exposed-files"] },
            rules: { enable: ["my-custom-rule"] },
        };

        const opts = resolveScanOptions(NO_FLAGS, cfg, ROOT);

        expect(opts.rules?.enable).toStrictEqual(["my-custom-rule", "tag:preset:exposed-files"]);
    });

    it("dedupes when `rules.enable` already names the same preset tag", () => {
        expect.assertions(1);

        const cfg: VisSecretsConfig = {
            config: { presets: ["exposed-files"] },
            rules: { enable: ["tag:preset:exposed-files", "tag:preset:weak-passwords"] },
        };

        const opts = resolveScanOptions(NO_FLAGS, cfg, ROOT);

        expect(opts.rules?.enable).toStrictEqual(["tag:preset:exposed-files", "tag:preset:weak-passwords"]);
    });

    it("`--enable-rule` flag wins over `rules.enable`, then presets append", () => {
        expect.assertions(1);

        const cfg: VisSecretsConfig = {
            config: { presets: ["exposed-files"] },
            rules: { enable: ["from-config"] },
        };

        const opts = resolveScanOptions({ enableRule: ["from-flag"] }, cfg, ROOT);

        expect(opts.rules?.enable).toStrictEqual(["from-flag", "tag:preset:exposed-files"]);
    });

    it("returns `enable: undefined` when neither flags, `rules.enable`, nor presets are set", () => {
        expect.assertions(1);

        const opts = resolveScanOptions(NO_FLAGS, undefined, ROOT);

        expect(opts.rules?.enable).toBeUndefined();
    });
});
