import { readdirSync, readFileSync } from "node:fs";
import { parse } from "node:path";

type AppExport = { [key: string]: any; app?: string | { app?: string } };

export const ALLOWED_EXTENSIONS = [".js", ".ts", ".mjs", ".cjs"];

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

    return null;
};

export const getFrameworkName = (directory: string): "express" | "fastify" | "hapi" | "koa" | "next" | null => {
    const packageJSONFilePath = `${directory}/package.json`;
    const packageJSON = JSON.parse(readFileSync(packageJSONFilePath).toString());
    const { dependencies } = packageJSON;

    if (dependencies.express) {
        return "express";
    }

    if (dependencies.koa && (dependencies["@koa/router"] || dependencies["koa-router"])) {
        return "koa";
    }

    if (dependencies.next) {
        return "next";
    }

    if (dependencies["@hapi/hapi"]) {
        return "hapi";
    }

    if (dependencies.fastify) {
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (typeof (appExport.app as { app?: string })?.app === "string") {
            return appExport.app as { app: string };
        }

        return appExport;
    }

    return appExport.app ?? appExport;
};
