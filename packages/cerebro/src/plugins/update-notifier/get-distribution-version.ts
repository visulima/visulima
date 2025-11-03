import type { IncomingMessage } from "node:http";
import { get } from "node:https";

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
                        reject(new Error("Error getting version"));
                    }

                    resolve(version as string);
                } catch {
                    reject(new Error("Could not parse version response"));
                }
            });
        }).on("error", (error) => reject(error));
    });
};

export default getDistributionVersion;
