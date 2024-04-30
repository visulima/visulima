import { existsSync } from "node:fs";
import path from "node:path";

import { readFileSync } from "@visulima/fs";
import type { RawSourceMap } from "source-map-js";
import { SourceMapConsumer } from "source-map-js";

import { dataURIRe } from "../loaders/postcss/common";
import { isAbsolutePath, normalizePath, relativePath, resolvePath } from "./path";

const mapBlockRe = /(?:\n|\r\n)?\/\*[#*@]+\s*sourceMappingURL\s*=\s*(\S+)\s*\*+\//g;
const mapLineRe = /(?:\n|\r\n)?\/\/[#@]+\s*sourceMappingURL\s*=\s*(\S+)\s*?$/gm;

export async function getMap(code: string, id?: string): Promise<string | undefined> {
    const [, data] = mapBlockRe.exec(code) ?? mapLineRe.exec(code) ?? [];

    if (!data) {
        return;
    }

    const [, uriMap] = dataURIRe.exec(data) ?? [];

    if (uriMap) {
        return Buffer.from(uriMap, "base64").toString();
    }

    if (!id) {
        throw new Error("Extracted map detected, but no ID is provided");
    }

    const mapFileName = path.resolve(path.dirname(id), data);
    const exists = await existsSync(mapFileName);

    if (!exists) {
        return;
    }

    return readFileSync(mapFileName);
}

export const stripMap = (code: string): string => code.replaceAll(mapBlockRe, "").replaceAll(mapLineRe, "");

class MapModifier {
    private readonly map?: RawSourceMap;

    constructor(map?: RawSourceMap | string) {
        if (typeof map === "string") {
            try {
                this.map = JSON.parse(map) as RawSourceMap;
            } catch {
                /* noop */
            }
        } else {
            this.map = map;
        }
    }

    modify(f: (m: RawSourceMap) => void): this {
        if (!this.map) {
            return this;
        }

        f(this.map);

        return this;
    }

    modifySources(op: (source: string) => string): this {
        if (!this.map) {
            return this;
        }

        if (this.map.sources) {
            this.map.sources = this.map.sources.map((s) => op(s));
        }

        return this;
    }

    resolve(dir = process.cwd()): this {
        return this.modifySources((source) => {
            if (source === "<no source>") {
                return source;
            }

            return resolvePath(dir, source);
        });
    }

    relative(dir = process.cwd()): this {
        return this.modifySources((source) => {
            if (source === "<no source>") {
                return source;
            }

            if (isAbsolutePath(source)) {
                return relativePath(dir, source);
            }

            return normalizePath(source);
        });
    }

    toObject(): RawSourceMap | undefined {
        return this.map;
    }

    toString(): string | undefined {
        if (!this.map) {
            return this.map;
        }

        return JSON.stringify(this.map);
    }

    toConsumer(): SourceMapConsumer | undefined {
        if (!this.map) {
            return this.map;
        }

        return new SourceMapConsumer(this.map);
    }

    toCommentData(): string {
        const map = this.toString();

        if (!map) {
            return "";
        }

        const sourceMapData = Buffer.from(map).toString("base64");

        return `\n/*# sourceMappingURL=data:application/json;base64,${sourceMapData} */`;
    }

    toCommentFile(fileName: string): string {
        if (!this.map) {
            return "";
        }

        return `\n/*# sourceMappingURL=${fileName} */`;
    }
}

export const mm = (map?: RawSourceMap | string): MapModifier => new MapModifier(map);
