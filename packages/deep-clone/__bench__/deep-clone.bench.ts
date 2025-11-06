import { deepCopy as mfederczukClone } from "@mfederczuk/deeptools";
import ungapStructuredClone from "@ungap/structured-clone";
import data from "@visulima/deep-clone/__fixtures__/data.json";
import { deepClone as visulimaDeepCopy } from "@visulima/deep-clone/dist/dist";
import cloneDeep from "clone-deep";
import deepCopy from "deep-copy";
import fastCopy, { copyStrict as fastCopyStrict } from "fast-copy";
import lodashCloneDeep from "lodash.clonedeep";
import nanoCopy from "nano-copy";
import nanoclone from "nanoclone";
import plainObjectClone from "plain-object-clone";
import { clone as ramdaClone } from "ramda";
import rfdc from "rfdc";
import { bench, describe } from "vitest";

describe("clone", () => {
    bench("@visulima/deep-clone - loose", () => {
        const cloneData = visulimaDeepCopy(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("@visulima/deep-clone - strict", () => {
        const cloneData = visulimaDeepCopy(data, { strict: true });

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("deep-copy", () => {
        const cloneData = deepCopy(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("lodash.clonedeep", () => {
        const cloneData = lodashCloneDeep(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("clone-deep", () => {
        const cloneData = cloneDeep(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("fast-copy", () => {
        const cloneData = fastCopy(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("fast-copy strict", () => {
        const cloneData = fastCopyStrict(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("plain-object-clone", () => {
        const cloneData = plainObjectClone(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("nano-copy", () => {
        const cloneData = nanoCopy(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("ramda.clone", () => {
        const cloneData = ramdaClone(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("nanoclone", () => {
        const cloneData = nanoclone(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("@mfederczuk/deeptools copy", () => {
        const cloneData = mfederczukClone(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("rfdc - default", () => {
        const cloneData = rfdc()(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("rfdc - proto", () => {
        const cloneData = rfdc({ proto: true })(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("rfdc - circles", () => {
        const cloneData = rfdc({ circles: true })(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("rfdc - circles and proto", () => {
        const cloneData = rfdc({ circles: true, proto: true })(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("@ungap/structured-clone clone", () => {
        const cloneData = ungapStructuredClone(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });

    bench("structured-clone clone", () => {
        const cloneData = structuredClone(data);

        if (cloneData === data) {
            throw new Error("Clone is the same as the original");
        }
    });
});
