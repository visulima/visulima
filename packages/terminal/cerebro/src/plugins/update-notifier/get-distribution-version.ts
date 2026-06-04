import type { IncomingMessage } from "node:http";
import { get } from "node:https";

import UpdateNotifierError from "../../errors/update-notifier-error";

const getDistributionVersion = async (packageName: string, distributionTag: string, registryUrl: string): Promise<string> => {
    const url = registryUrl.replace("__NAME__", packageName);

    const MAX_BODY_SIZE = 512 * 1024;

    return await new Promise<string>((resolve, reject) => {
        get(url, (message: IncomingMessage) => {
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
        }).on("error", (error) => {
            reject(error);
        });
    });
};

export default getDistributionVersion;
