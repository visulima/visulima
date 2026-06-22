import { describe, expect, it } from "vitest";

import { unflagArgs } from "../../src/runtime/unflag";

const LOCALSTORAGE_FILE = "/tmp/vis-localstorage.json";

describe(unflagArgs, () => {
    it("enables every in-band rule for `all` on a recent Node", () => {
        expect.hasAssertions();

        const flags = unflagArgs("all", "24.0.0", LOCALSTORAGE_FILE);

        expect(flags).toContain("--enable-source-maps");
        expect(flags).toContain("--experimental-sqlite");
        expect(flags).toContain("--experimental-webstorage");
        expect(flags).toContain("--experimental-eventsource");
        expect(flags).toContain("--experimental-vm-modules");
    });

    it("selects a single rule by key", () => {
        expect.hasAssertions();

        expect(unflagArgs("vm-modules", "22.0.0", LOCALSTORAGE_FILE)).toStrictEqual(["--experimental-vm-modules"]);
        expect(unflagArgs("sqlite", "22.5.0", LOCALSTORAGE_FILE)).toStrictEqual(["--experimental-sqlite"]);
    });

    it("omits a rule whose min-Node is above the running version", () => {
        expect.hasAssertions();

        // node:sqlite needs 22.5; on 22.4 it must not be injected.
        expect(unflagArgs("sqlite", "22.4.0", LOCALSTORAGE_FILE)).toStrictEqual([]);
    });

    describe("webSocket band (20.10–21.x)", () => {
        it("injects --experimental-websocket inside the band", () => {
            expect.hasAssertions();

            expect(unflagArgs("websocket", "20.10.0", LOCALSTORAGE_FILE)).toStrictEqual(["--experimental-websocket"]);
            expect(unflagArgs("websocket", "21.7.3", LOCALSTORAGE_FILE)).toStrictEqual(["--experimental-websocket"]);
        });

        it("omits the flag below the band (< 20.10)", () => {
            expect.hasAssertions();

            expect(unflagArgs("websocket", "20.9.0", LOCALSTORAGE_FILE)).toStrictEqual([]);
        });

        it("omits the flag above the band (22+, where WebSocket is default-on)", () => {
            expect.hasAssertions();

            expect(unflagArgs("websocket", "22.0.0", LOCALSTORAGE_FILE)).toStrictEqual([]);
            expect(unflagArgs("websocket", "24.0.0", LOCALSTORAGE_FILE)).toStrictEqual([]);
        });

        it("is excluded from `all` on Node 22+ even though every other rule fires", () => {
            expect.hasAssertions();

            expect(unflagArgs("all", "22.5.0", LOCALSTORAGE_FILE)).not.toContain("--experimental-websocket");
        });
    });

    describe("vm.Module", () => {
        it("injects --experimental-vm-modules on every supported Node (no upper bound)", () => {
            expect.hasAssertions();

            expect(unflagArgs("vm-modules", "22.0.0", LOCALSTORAGE_FILE)).toContain("--experimental-vm-modules");
            expect(unflagArgs("vm-modules", "24.10.0", LOCALSTORAGE_FILE)).toContain("--experimental-vm-modules");
        });
    });

    describe("localstorage convenience key", () => {
        it("adds webstorage + a localstorage-file flag", () => {
            expect.hasAssertions();

            const flags = unflagArgs("localstorage", "24.0.0", LOCALSTORAGE_FILE);

            expect(flags).toContain("--experimental-webstorage");
            expect(flags).toContain(`--localstorage-file=${LOCALSTORAGE_FILE}`);
        });

        it("does not duplicate --experimental-webstorage when both keys are selected", () => {
            expect.hasAssertions();

            const flags = unflagArgs("webstorage,localstorage", "24.0.0", LOCALSTORAGE_FILE);

            expect(flags.filter((flag) => flag === "--experimental-webstorage")).toHaveLength(1);
        });
    });

    it("returns nothing for an unrecognised key", () => {
        expect.hasAssertions();

        expect(unflagArgs("doesnotexist", "24.0.0", LOCALSTORAGE_FILE)).toStrictEqual([]);
    });
});
