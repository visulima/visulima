/* eslint-disable no-restricted-imports,e18e/ban-dependencies,import/no-extraneous-dependencies,import/no-relative-packages,simple-import-sort/imports,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-call */
import { deepCopy as mfederczukClone } from "@mfederczuk/deeptools";
import ungapStructuredClone from "@ungap/structured-clone";
import { deepClone as visulimaDeepCopy } from "@visulima/deep-clone";
import data from "../__fixtures__/data.json" with { type: "json" };
import cloneDeep from "clone-deep";
import deepCopy from "deep-copy";
import fastCopy, { copyStrict as fastCopyStrict } from "fast-copy";
import lodashCloneDeep from "lodash.clonedeep";
import nanoCopy from "nano-copy";
import nanoclone from "nanoclone";
import plainObjectClone from "plain-object-clone";
import { clone as ramdaClone } from "ramda";
import rfdc from "rfdc";
import { describe, test } from "vitest";

describe("clone", () => {
    test("@visulima/deep-clone - loose", async ({ bench }) => {
        await bench("@visulima/deep-clone - loose", () => {
            const cloneData = visulimaDeepCopy(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test("@visulima/deep-clone - strict", async ({ bench }) => {
        await bench("@visulima/deep-clone - strict", () => {
            const cloneData = visulimaDeepCopy(data, { strict: true });

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("deep-copy", async ({ bench }) => {
        await bench("deep-copy", () => {
            const cloneData = deepCopy(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("lodash.clonedeep", async ({ bench }) => {
        await bench("lodash.clonedeep", () => {
            const cloneData = lodashCloneDeep(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("clone-deep", async ({ bench }) => {
        await bench("clone-deep", () => {
            const cloneData = cloneDeep(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-copy", async ({ bench }) => {
        await bench("fast-copy", () => {
            const cloneData = fastCopy(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("fast-copy strict", async ({ bench }) => {
        await bench("fast-copy strict", () => {
            const cloneData = fastCopyStrict(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("plain-object-clone", async ({ bench }) => {
        await bench("plain-object-clone", () => {
            const cloneData = plainObjectClone(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("nano-copy", async ({ bench }) => {
        await bench("nano-copy", () => {
            const cloneData = nanoCopy(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("ramda.clone", async ({ bench }) => {
        await bench("ramda.clone", () => {
            const cloneData = ramdaClone(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("nanoclone", async ({ bench }) => {
        await bench("nanoclone", () => {
            const cloneData = nanoclone(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("@mfederczuk/deeptools copy", async ({ bench }) => {
        await bench("@mfederczuk/deeptools copy", () => {
            const cloneData = mfederczukClone(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("rfdc - default", async ({ bench }) => {
        await bench("rfdc - default", () => {
            const cloneData = rfdc()(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("rfdc - proto", async ({ bench }) => {
        await bench("rfdc - proto", () => {
            const cloneData = rfdc({ proto: true })(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("rfdc - circles", async ({ bench }) => {
        await bench("rfdc - circles", () => {
            const cloneData = rfdc({ circles: true })(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("rfdc - circles and proto", async ({ bench }) => {
        await bench("rfdc - circles and proto", () => {
            const cloneData = rfdc({ circles: true, proto: true })(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("@ungap/structured-clone clone", async ({ bench }) => {
        await bench("@ungap/structured-clone clone", () => {
            const cloneData = ungapStructuredClone(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });

    test.skipIf(process.env.CODSPEED_ENV)("structured-clone clone", async ({ bench }) => {
        await bench("structured-clone clone", () => {
            const cloneData = structuredClone(data);

            if (cloneData === data) {
                throw new Error("Clone is the same as the original");
            }
        }).run();
    });
});
