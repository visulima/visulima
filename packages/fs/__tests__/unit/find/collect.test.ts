import { fileURLToPath } from "node:url";

import { join, resolve } from "@visulima/path";
import { describe, expect, it } from "vitest";

import collect from "../../../src/find/collect";
import collectSync from "../../../src/find/collect-sync";

const fixture = resolve(fileURLToPath(import.meta.url), "../../../../__fixtures__");

describe.each([
    ["collect", collect],
    ["collectSync", collectSync],
])("%s", (name: string, function_) => {
    it("should collects default file extensions from a valid directory", async () => {
        expect.assertions(3);

        // Replace with a real directory for your test
        let entries = function_(join(fixture, "find-up"));

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "collect") {
            entries = await entries;
        }

        (entries as unknown as string[]).forEach((entry) => {
            const extension = entry.split(".").pop();

            expect("js").toStrictEqual(extension);
        });
    });

    it("collects custom file extensions from a valid directory", async () => {
        expect.assertions(1);

        // Replace with a real directory for your test
        let entries = function_(join(fixture, "collect"), { extensions: ["json"] });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "collect") {
            entries = await entries;
        }

        (entries as unknown as string[]).forEach((entry) => {
            const extension = entry.split(".").pop();

            expect(extension).toBe("json");
        });
    });

    it("throws an error for invalid directory", async () => {
        expect.assertions(1);

        const directory = "./Invalid_directory_name";

        try {
            await collect(directory);
        } catch (error) {
            // eslint-disable-next-line vitest/no-conditional-expect
            expect(error).toBeInstanceOf(Error);
        }
    });

    it("should overwrite the extensions with a empty array", async () => {
        expect.assertions(1);

        // Replace with a real directory for your test
        let entries = function_(join(fixture, "find-up"), { extensions: [] });

        // eslint-disable-next-line vitest/no-conditional-in-test
        if (name === "collect") {
            entries = await entries;
        }

        expect(entries).toHaveLength(11);
    });
});
