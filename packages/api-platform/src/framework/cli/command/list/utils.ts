import { readdirSync, readFileSync } from "node:fs";
import { parse } from "node:path";

export const ALLOWED_EXTENSIONS = [".js", ".ts", ".mjs", ".cjs"];

export const getAppWorkingDirectoryPath = (appFilePath: string) => {
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

export const getFrameworkName = (directory: string) => {
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

export const getApp = (appExport: { [key: string]: any }, frameworkName: string) => {
    const isExportEmpty = Object.keys(appExport).length === 0;

    if (isExportEmpty) {
        return null;
    }

    if (frameworkName === "hapi") {
        return appExport.app?.app ? appExport.app : appExport;
    }

    return appExport.app || appExport;
};
