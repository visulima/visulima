import { readdirSync, readFileSync } from "node:fs";

import { parse } from "@visulima/path";
import type { PackageJson } from "type-fest";

interface AppExport {
    [key: string]: any;
    app?: string | { app?: string };
}

export const ALLOWED_EXTENSIONS = [".js", ".ts", ".mjs", ".cjs"];

export const getAppWorkingDirectoryPath = (appFilePath: string): string | null => {
    let lastParsedPath = parse(appFilePath);

    // Once the following condition returns false it means we traversed the whole file system
    // eslint-disable-next-line no-loops/no-loops
    while (lastParsedPath.base && lastParsedPath.root !== lastParsedPath.dir) {
        const parentDirectionItems = readdirSync(lastParsedPath.dir);

        const packageJSON = parentDirectionItems.find((item) => item === "package.json");

        if (packageJSON) {
            return lastParsedPath.dir;
        }

        lastParsedPath = parse(lastParsedPath.dir);
    }

    return null;
};

export const getFrameworkName = (directory: string): "express" | "fastify" | "hapi" | "koa" | "next" | null => {
    const packageJSONFilePath = `${directory}/package.json`;

    const { dependencies } = JSON.parse(readFileSync(packageJSONFilePath).toString()) as PackageJson;

    if (dependencies?.express) {
        return "express";
    }

    if (dependencies?.koa && (dependencies["@koa/router"] || dependencies["koa-router"])) {
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

    return null;
};

export const getApp = (appExport: AppExport, frameworkName: "express" | "fastify" | "hapi" | "koa" | "next" | null): AppExport | string | null => {
    const isExportEmpty = Object.keys(appExport).length === 0;

    if (isExportEmpty) {
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
