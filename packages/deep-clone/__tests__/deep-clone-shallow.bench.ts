import { deepCopy as mfederczukClone } from "@mfederczuk/deeptools";
import cloneDeep from "clone-deep";
import deepCopy from "deep-copy";
import fastCopy from "fast-copy";
import jsondiffpatch from "jsondiffpatch";
import lodashCloneDeep from "lodash.clonedeep";
import nanoCopy from "nano-copy";
import nanoclone from "nanoclone";
import plainObjectClone from "plain-object-clone";
import { clone as ramdaClone } from "ramda";
import rfdc from "rfdc";
import { bench, describe } from "vitest";

import visulimaDeepCopy from "../src";

const data = { a: "a", b: "b", c: "c" };

describe("shallow clone", () => {
    it("@visulima/deep-clone - default", () => {
        visulimaDeepCopy(data);
    });

    it("@visulima/deep-clone - proto", () => {
        visulimaDeepCopy(data, {
            proto: true,
        });
    });

    it("@visulima/deep-clone - circles", () => {
        visulimaDeepCopy(data, {
            circles: true,
        });
    });

    it("@visulima/deep-clone - circles and proto", () => {
        visulimaDeepCopy(data, {
            circles: true,
            proto: true,
        });
    });

    it("deep-copy", () => {
        deepCopy(data);
    });

    it("lodash.clonedeep", () => {
        lodashCloneDeep(data);
    });

    it("clone-deep", () => {
        cloneDeep(data);
    });

    it("fast-copy", () => {
        fastCopy(data);
    });

    it("plain-object-clone", () => {
        plainObjectClone(data);
    });

    it("nano-copy", () => {
         
        nanoCopy(data);
    });

    it("ramda.clone", () => {
        ramdaClone(data);
    });

    it("nanoclone", () => {
        nanoclone(data);
    });

    it("@mfederczuk/deeptools copy", () => {
        mfederczukClone(data);
    });

    it("rfdc - default", () => {
         
        rfdc()(data);
    });

    it("rfdc - proto", () => {
         
        rfdc({ proto: true })(data);
    });

    it("rfdc - circles", () => {
         
        rfdc({ circles: true })(data);
    });

    it("rfdc - circles and proto", () => {
         
        rfdc({ circles: true, proto: true })(data);
    });

    it("jsondiffpatch clone", () => {
         
        jsondiffpatch.clone(data);
    });
});
