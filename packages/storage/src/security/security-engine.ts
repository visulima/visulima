import type { Readable } from "node:stream";

import type { File } from "../utils/file";
import type { ScanResult, SecurityConfig, SecurityRule } from "./types";

export class SecurityEngine {
    private rules: SecurityRule[];

    public constructor(config: SecurityConfig) {
        this.rules = config.scanners.map((item) => {
            if ("scan" in item) {
                return { scanner: item };
            }
            return item;
        });
    }

    public async verify(file: File, content: Readable | Buffer | string): Promise<void> {
        const matchingRules = this.rules.filter((rule) => {
            // Check MIME type
            if (!this.matchesMimeType(file.contentType, rule.mimeTypes)) {
                return false;
            }

            // Check file size
            if (rule.maxSize !== undefined && file.size !== undefined && Number(file.size) > rule.maxSize) {
                return false;
            }

            return true;
        });

        if (matchingRules.length === 0) {
            return;
        }

        const results = await Promise.all(
            matchingRules.map(async (rule) => {
                try {
                    const result = await rule.scanner.scan(file, content);
                    return { name: rule.scanner.name, result };
                } catch (error) {
                    throw new Error(
                        `Security scanner failed: ${rule.scanner.name} - ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }),
        );

        const detections = results.filter((item) => item.result.detected);

        if (detections.length > 0) {
            const reasons = detections.map((d) => `${d.name}: ${d.result.reason || "Threat detected"}`).join("; ");
            throw new Error(`Security check failed: ${reasons}`);
        }
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
