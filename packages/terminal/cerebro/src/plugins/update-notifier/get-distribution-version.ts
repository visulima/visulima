import type { IncomingMessage } from "node:http";
import { get } from "node:https";

import UpdateNotifierError from "../../errors/update-notifier-error";

/**
 * Default timeout (ms) for the registry request. Kept short so a slow or
 * blackholed registry can never hang the user's command — the worst case is a
 * silently-skipped update check, not an indefinite stall.
 */
const DEFAULT_TIMEOUT_MS = 5000;

const getDistributionVersion = async (
    packageName: string,
    distributionTag: string,
    registryUrl: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> => {
    const url = registryUrl.replace("__NAME__", packageName);

    const MAX_BODY_SIZE = 512 * 1024;

    return await new Promise<string>((resolve, reject) => {
        const request = get(url, { timeout: timeoutMs }, (message: IncomingMessage) => {
            if (message.statusCode !== undefined && (message.statusCode < 200 || message.statusCode >= 300)) {
                reject(
                    new UpdateNotifierError(`Unexpected status code ${String(message.statusCode)}`, "VERSION_FETCH_ERROR", { distributionTag, packageName }),
                );
                message.resume();

                return;
            }

            let body = "";
            let aborted = false;

            message.on("data", (chunk) => {
                if (aborted) {
                    return;
                }

                body += String(chunk);

                if (body.length > MAX_BODY_SIZE) {
                    aborted = true;
                    reject(new UpdateNotifierError("Response too large", "VERSION_FETCH_ERROR", { distributionTag, packageName }));
                    message.destroy();
                }
            });
            message.on("end", () => {
                if (aborted) {
                    return;
                }

                try {
                    const json = JSON.parse(body) as Record<string, string>;
                    const version = json[distributionTag];

                    if (!version) {
                        reject(new UpdateNotifierError("Error getting version", "VERSION_FETCH_ERROR", { distributionTag, packageName }));

                        return;
                    }

                    resolve(version);
                } catch {
                    reject(new UpdateNotifierError("Could not parse version response", "VERSION_PARSE_ERROR", { distributionTag, packageName }));
                }
            });
        });

        request.on("timeout", () => {
            // `timeout` only signals inactivity; it does not abort the socket.
            request.destroy(new UpdateNotifierError("Request timed out", "VERSION_FETCH_ERROR", { distributionTag, packageName }));
        });

        request.on("error", (error) => {
            reject(error);
        });
    });
};

export default getDistributionVersion;
