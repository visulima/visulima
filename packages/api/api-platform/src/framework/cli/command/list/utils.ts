import { readdirSync, readFileSync } from "node:fs";

import { parse } from "@visulima/path";
import type { PackageJson } from "type-fest";

interface AppExport {
    [key: string]: unknown;
    app?: string | { app?: string };
}

export const ALLOWED_EXTENSIONS: string[] = [".js", ".ts", ".mjs", ".cjs"];

export const getAppWorkingDirectoryPath = (appFilePath: string): string | null => {
    let lastParsedPath = parse(appFilePath);

    // Once the following condition returns false it means we traversed the whole file system
    while (lastParsedPath.base && lastParsedPath.root !== lastParsedPath.dir) {
        const parentDirectionItems = readdirSync(lastParsedPath.dir);

        const packageJSON = parentDirectionItems.find((item) => item === "package.json");

        if (packageJSON) {
            return lastParsedPath.dir;
        }

        lastParsedPath = parse(lastParsedPath.dir);
    }

    // eslint-disable-next-line unicorn/no-null -- public sentinel value preserved for backwards compatibility
    return null;
};

export const getFrameworkName = (directory: string): "express" | "fastify" | "hapi" | "koa" | "next" | null => {
    const packageJSONFilePath = `${directory}/package.json`;

    const { dependencies } = JSON.parse(readFileSync(packageJSONFilePath).toString()) as PackageJson;

    if (dependencies?.express) {
        return "express";
    }

    if (dependencies?.koa && (dependencies["@koa/router"] ?? dependencies["koa-router"])) {
        return "koa";
    }

    if (dependencies?.next) {
        return "next";
    }

    if (dependencies?.["@hapi/hapi"]) {
        return "hapi";
    }

    if (dependencies?.fastify) {
        return "fastify";
    }

    // eslint-disable-next-line unicorn/no-null -- public sentinel value preserved for backwards compatibility
    return null;
};

// eslint-disable-next-line sonarjs/function-return-type -- intentional union: returns the resolved app object, an extracted hapi app reference, or null when the export is empty
export const getApp = (appExport: AppExport, frameworkName: "express" | "fastify" | "hapi" | "koa" | "next" | null): AppExport | string | null => {
    const isExportEmpty = Object.keys(appExport).length === 0;

    if (isExportEmpty) {
        // eslint-disable-next-line unicorn/no-null -- public sentinel value preserved for backwards compatibility
        return null;
    }

    if (frameworkName === "hapi") {
        if (typeof (appExport.app as { app?: string }).app === "string") {
            return appExport.app as { app: string };
        }

        return appExport;
    }

    return appExport.app ?? appExport;
};
