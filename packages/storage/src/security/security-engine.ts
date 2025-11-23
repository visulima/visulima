import type { Readable } from "node:stream";

import type { File } from "../utils/file";
import type { SecurityConfig } from "./types";

export class SecurityEngine {
    private config: SecurityConfig;

    public constructor(config: SecurityConfig) {
        this.config = config;
    }

    public async verify(file: File, content: Readable | Buffer | string): Promise<void> {
        const rules = this.config.rules.filter((rule) => this.matchesMimeType(file.contentType, rule.mimeTypes));

        await Promise.all(
            rules.map(async (rule) => {
                try {
                    await rule.handler.validate(file, content);
                } catch (error) {
                    throw new Error(`Security check failed: ${rule.handler.name} - ${error instanceof Error ? error.message : String(error)}`);
                }
            }),
        );
    }

    private matchesMimeType(contentType: string, mimeTypes?: string[]): boolean {
        if (!mimeTypes || mimeTypes.length === 0) {
            return true;
        }

        return mimeTypes.some((pattern) => {
            if (pattern === "*/*") {
                return true;
            }

            if (pattern.endsWith("/*")) {
                const [type] = pattern.split("/");
                return contentType.startsWith(`${type}/`);
            }

            return contentType === pattern;
        });
    }
}
