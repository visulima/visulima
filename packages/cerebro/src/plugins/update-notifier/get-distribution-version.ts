import type { IncomingMessage } from "node:http";
import { get } from "node:https";

import UpdateNotifierError from "../../errors/update-notifier-error";

const getDistributionVersion = async (packageName: string, distributionTag: string, registryUrl: string): Promise<string> => {
    const url = registryUrl.replace("__NAME__", packageName);

    return await new Promise<string>((resolve, reject) => {
        get(url, (message: IncomingMessage) => {
            let body = "";

            // eslint-disable-next-line no-return-assign
            message.on("data", (chunk) => (body += chunk));
            message.on("end", () => {
                try {
                    const json = JSON.parse(body) as Record<string, string>;
                    const version = json[distributionTag];

                    if (!version) {
                        reject(new UpdateNotifierError("Error getting version", "VERSION_FETCH_ERROR", { distributionTag, packageName }));
                    }

                    resolve(version as string);
                } catch {
                    reject(new UpdateNotifierError("Could not parse version response", "VERSION_PARSE_ERROR", { distributionTag, packageName }));
                }
            });
        }).on("error", (error) => reject(error));
    });
};

export default getDistributionVersion;
