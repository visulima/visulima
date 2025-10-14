import { join } from "@visulima/path";
import { describe, expect, it } from "vitest";

import { getApp, getAppWorkingDirectoryPath, getFrameworkName } from "../../../../../src/framework/cli/command/list/utils";

const baseDirectory = __dirname;
const fixturesDirectory = join(baseDirectory, "../../../../../__fixtures__");

describe("utils", () => {
    describe(getAppWorkingDirectoryPath, () => {
        it("should return the path to the directory containing the package.json file", () => {
            expect.assertions(1);

            const result = getAppWorkingDirectoryPath(`${baseDirectory}/utils.test.ts`);

            expect(result).toStrictEqual(join(baseDirectory, "..", "..", "..", "..", ".."));
        });

        it("should return null if the app file path is a root directory", () => {
            expect.assertions(1);

            const result = getAppWorkingDirectoryPath(baseDirectory);

            expect(result).toStrictEqual(join(baseDirectory, "..", "..", "..", "..", ".."));
        });
    });

    describe(getFrameworkName, () => {
        it("should return 'express' if the directory contains an express package in the dependencies field of the package.json file", () => {
            expect.assertions(1);

            const result = getFrameworkName(join(fixturesDirectory, "framework/express"));

            expect(result).toBe("express");
        });

        it("should return 'koa' if the directory contains a koa package and a koa router package in the dependencies field of the package.json file", () => {
            expect.assertions(1);

            const result = getFrameworkName(join(fixturesDirectory, "framework/koa"));

            expect(result).toBe("koa");
        });

        it("should return 'next' if the directory contains a next package in the dependencies field of the package.json file", () => {
            expect.assertions(1);

            const result = getFrameworkName(join(fixturesDirectory, "framework/next"));

            expect(result).toBe("next");
        });

        it("should return 'hapi' if the directory contains a hapi package in the dependencies field of the package.json file", () => {
            expect.assertions(1);

            const result = getFrameworkName(join(fixturesDirectory, "framework/hapi"));

            expect(result).toBe("hapi");
        });

        it("should return 'fastify' if the directory contains a fastify package in the dependencies field of the package.json file", () => {
            expect.assertions(1);

            const result = getFrameworkName(join(fixturesDirectory, "framework/fastify"));

            expect(result).toBe("fastify");
        });

        it("should return null if the directory does not contain any of the supported frameworks in the dependencies field of the package.json file", () => {
            expect.assertions(1);

            const result = getFrameworkName(join(fixturesDirectory, "framework/unknown"));

            expect(result).toBeNull();
        });
    });

    describe(getApp, () => {
        it("returns null when appExport is empty", async () => {
            expect.assertions(1);

            const appExport = {};
            const frameworkName = "hapi";
            const expected = null;
            const actual = getApp(appExport, frameworkName);

            expect(actual).toStrictEqual(expected);
        });

        it("returns app when frameworkName is hapi and app property exists", async () => {
            expect.assertions(1);

            const appExport = { app: { app: "app" } };
            const frameworkName = "hapi";
            const expected = { app: "app" };
            const actual = getApp(appExport, frameworkName);

            expect(actual).toStrictEqual(expected);
        });

        it("returns app when frameworkName is not hapi and app property exists", async () => {
            expect.assertions(1);

            const appExport = { app: "app" };
            const frameworkName = "express";
            const expected = "app";
            const actual = getApp(appExport, frameworkName);

            expect(actual).toStrictEqual(expected);
        });

        it("returns appExport when frameworkName is hapi and app property does not exist", async () => {
            expect.assertions(1);

            const appExport = { app: {} };
            const frameworkName = "hapi";
            const expected = { app: {} };
            const actual = getApp(appExport, frameworkName);

            expect(actual).toStrictEqual(expected);
        });

        it("returns appExport when frameworkName is not hapi and app property does not exist", async () => {
            expect.assertions(1);

            const appExport = { app: {} };
            const frameworkName = "express";
            const expected = {};
            const actual = getApp(appExport, frameworkName);

            expect(actual).toStrictEqual(expected);
        });
    });
});
