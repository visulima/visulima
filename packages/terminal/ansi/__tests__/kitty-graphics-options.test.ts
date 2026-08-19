import { describe, expect, it } from "vitest";

import kittyGraphics from "../src/kitty-graphics";
import kittyGraphicsOptions from "../src/kitty-graphics-options";

describe(kittyGraphicsOptions, () => {
    it("emits nothing when every value is the protocol default", () => {
        expect.assertions(2);

        expect(kittyGraphicsOptions({})).toStrictEqual([]);
        expect(kittyGraphicsOptions({ action: "transmit", format: "rgba", quiet: 0, transmission: "direct" })).toStrictEqual([]);
    });

    it("emits a negative z-index", () => {
        expect.assertions(3);

        // A negative z draws the image behind the text; dropping it turns a background into a
        // foreground image.
        expect(kittyGraphicsOptions({ z: -1 })).toStrictEqual(["z=-1"]);
        expect(kittyGraphicsOptions({ z: 1 })).toStrictEqual(["z=1"]);
        expect(kittyGraphicsOptions({ z: 0 })).toStrictEqual([]);
    });

    it("maps the enums to their protocol letters", () => {
        expect.assertions(4);

        expect(kittyGraphicsOptions({ format: "png" })).toStrictEqual(["f=100"]);
        expect(kittyGraphicsOptions({ transmission: "file" })).toStrictEqual(["t=f"]);
        expect(kittyGraphicsOptions({ action: "transmit-display" })).toStrictEqual(["a=T"]);
        expect(kittyGraphicsOptions({ compressed: true })).toStrictEqual(["o=z"]);
    });

    it("keeps display size and cell size apart", () => {
        expect.assertions(1);

        expect(kittyGraphicsOptions({ columns: 3, height: 40, rows: 4, width: 30 })).toStrictEqual(["w=30", "h=40", "c=3", "r=4"]);
    });

    it("uppercases the delete code when resources should go too", () => {
        expect.assertions(2);

        expect(kittyGraphicsOptions({ delete: "i" })).toStrictEqual(["d=i"]);
        expect(kittyGraphicsOptions({ delete: "i", deleteResources: true })).toStrictEqual(["d=I"]);
    });

    it("composes with the sequence framer", () => {
        expect.assertions(1);

        const sequence = kittyGraphics("BASE64", ...kittyGraphicsOptions({ action: "transmit-display", format: "png", z: -1 }));

        expect(sequence).toBe(`${String.fromCodePoint(0x1B)}_Gf=100,z=-1,a=T;BASE64${String.fromCodePoint(0x1B)}\\`);
    });
});
