import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { getApp, getAppWorkingDirectoryPath, getFrameworkName } from "../../../../../src/framework/cli/command/list/utils";

// eslint-disable-next-line unicorn/prefer-module
const baseDirectory = __dirname;
const fixturesDirectory = join(baseDirectory, "../../../../../__fixtures__");

describe("utils", () => {
    describe("getAppWorkingDirectoryPath", () => {
        it("should return the path to the directory containing the package.json file", () => {
            const result = getAppWorkingDirectoryPath(`${baseDirectory}/utils.test.ts`);

            expect(result).toEqual(join(baseDirectory, "..", "..", "..", "..", ".."));
        });

        it("should return null if the app file path is a root directory", () => {
            const result = getAppWorkingDirectoryPath(baseDirectory);

            expect(result).toEqual(join(baseDirectory, "..", "..", "..", "..", ".."));
        });
    });

    describe("getFrameworkName", () => {
        it("should return 'express' if the directory contains an express package in the dependencies field of the package.json file", () => {
            const result = getFrameworkName(join(fixturesDirectory, "framework/express"));

            expect(result).toEqual("express");
        });

        it("should return 'koa' if the directory contains a koa package and a koa router package in the dependencies field of the package.json file", () => {
            const result = getFrameworkName(join(fixturesDirectory, "framework/koa"));

            expect(result).toEqual("koa");
        });

        it("should return 'next' if the directory contains a next package in the dependencies field of the package.json file", () => {
            const result = getFrameworkName(join(fixturesDirectory, "framework/next"));

            expect(result).toEqual("next");
        });

        it("should return 'hapi' if the directory contains a hapi package in the dependencies field of the package.json file", () => {
            const result = getFrameworkName(join(fixturesDirectory, "framework/hapi"));

            expect(result).toEqual("hapi");
        });

        it("should return 'fastify' if the directory contains a fastify package in the dependencies field of the package.json file", () => {
            const result = getFrameworkName(join(fixturesDirectory, "framework/fastify"));

            expect(result).toEqual("fastify");
        });

        it("should return null if the directory does not contain any of the supported frameworks in the dependencies field of the package.json file", () => {
            const result = getFrameworkName(join(fixturesDirectory, "framework/unknown"));

            expect(result).toEqual(null);
        });
    });

    describe("getApp", () => {
        it("returns null when appExport is empty", async () => {
            const appExport = {};
            const frameworkName = "hapi";
            const expected = null;
            const actual = getApp(appExport, frameworkName);

            expect(actual).toEqual(expected);
        });

        it("returns app when frameworkName is hapi and app property exists", async () => {
            const appExport = { app: { app: "app" } };
            const frameworkName = "hapi";
            const expected = { app: "app" };
            const actual = getApp(appExport, frameworkName);

            expect(actual).toEqual(expected);
        });

        it("returns app when frameworkName is not hapi and app property exists", async () => {
            const appExport = { app: "app" };
            const frameworkName = "express";
            const expected = "app";
            const actual = getApp(appExport, frameworkName);

            expect(actual).toEqual(expected);
        });

        it("returns appExport when frameworkName is hapi and app property does not exist", async () => {
            const appExport = { app: {} };
            const frameworkName = "hapi";
            const expected = { app: {} };
            const actual = getApp(appExport, frameworkName);

            expect(actual).toEqual(expected);
        });

        it("returns appExport when frameworkName is not hapi and app property does not exist", async () => {
            const appExport = { app: {} };
            const frameworkName = "express";
            const expected = {};
            const actual = getApp(appExport, frameworkName);

            expect(actual).toEqual(expected);
        });
    });
});
