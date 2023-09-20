import { deepCopy as mfederczukClone } from "@mfederczuk/deeptools";
import cloneDeep from "clone-deep";
import deepCopy from "deep-copy";
import fastCopy from "fast-copy";
import { copy as fastestJsonCopy } from "fastest-json-copy";
import lodashCloneDeep from "lodash.clonedeep";
import nanoCopy from "nano-copy";
import nanoclone from "nanoclone";
import plainObjectClone from "plain-object-clone";
import { clone as ramdaClone } from "ramda";
import rfdc from "rfdc";
import jsondiffpatch from "jsondiffpatch";
import { bench, describe } from "vitest";

import visulimaDeepCopy from "../src";

const data = { a: "a", b: "b", c: "c" };

describe("shallow clone", () => {
    bench("@visulima/deep-clone - default", () => {
        visulimaDeepCopy(data);
    });

    bench("@visulima/deep-clone - proto", () => {
        visulimaDeepCopy(data, {
            proto: true,
        });
    });

    bench("@visulima/deep-clone - circles", () => {
        visulimaDeepCopy(data, {
            circles: true,
        });
    });

    bench("@visulima/deep-clone - circles and proto", () => {
        visulimaDeepCopy(data, {
            circles: true,
            proto: true,
        });
    });

    bench("deep-copy", () => {
        deepCopy(data);
    });

    bench("lodash.clonedeep", () => {
        lodashCloneDeep(data);
    });

    bench("clone-deep", () => {
        cloneDeep(data);
    });

    bench("fast-copy", () => {
        fastCopy(data);
    });

    bench("fastest-json-copy", () => {
        fastestJsonCopy(data);
    });

    bench("plain-object-clone", () => {
        plainObjectClone(data);
    });

    bench("nano-copy", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        nanoCopy(data);
    });

    bench("ramda.clone", () => {
        ramdaClone(data);
    });

    bench("nanoclone", () => {
        nanoclone(data);
    });

    bench("@mfederczuk/deeptools copy", () => {
        mfederczukClone(data);
    });

    bench("rfdc - default", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        rfdc()(data);
    });

    bench("rfdc - proto", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        rfdc({ proto: true })(data);
    });

    bench("rfdc - circles", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        rfdc({ circles: true })(data);
    });

    bench("rfdc - circles and proto", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        rfdc({ circles: true, proto: true })(data);
    });

    bench("jsondiffpatch clone", () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        jsondiffpatch.clone(data);
    });
});
