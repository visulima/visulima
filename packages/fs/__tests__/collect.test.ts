import { describe, expect, it } from "vitest";

import collect from "../src/collect";

describe("collect", () => {
    it("should collects default file extensions from a valid directory", async () => {
        expect.assertions(3);

        // Replace with a real directory for your test
        const directory = "./src";
        const entries = await collect(directory);

        entries.forEach((entry) => {
            const extension = entry.split(".").pop();

            expect("ts").toStrictEqual(extension);
        });
    });

    it("collects custom file extensions from a valid directory", async () => {
        expect.assertions(1);

        // Replace with a real directory for your test
        const directory = "./__fixtures__";
        const options = { extensions: ["json"] };
        const entries = await collect(directory, options);

        entries.forEach((entry) => {
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
