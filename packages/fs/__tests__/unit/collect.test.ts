import { describe, expect, it } from "vitest";

import collect from "../../src/collect";
import collectSync from "../../src/collect-sync";

describe.each([
    ["collect", collect],
    ["collectSync", collectSync],
])("%s", (name: string, function_) => {
    it("should collects default file extensions from a valid directory", async () => {
        expect.assertions(3);

        // Replace with a real directory for your test
        let entries = function_("./__fixtures__/find-up");

        if (name === "collect") {
            entries = await entries;
        }

        (entries as unknown as string[]).forEach((entry) => {
            const extension = entry.split(".").pop();

            expect("js").toStrictEqual(extension);
        });
    });

    it("collects custom file extensions from a valid directory", async () => {
        expect.assertions(3);

        // Replace with a real directory for your test
        let entries = function_("./__fixtures__", { extensions: ["json"] });

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
});
