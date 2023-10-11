import { BufferListStream } from "bl";

const readFromUrl = async (url: URL): Promise<string> =>
    await new Promise((resolve, reject) => {
        const protocol = url.protocol === "http" ? require("node:http") : require("node:https");

        protocol.get(url, (response) => {
            response.setEncoding("utf8");
            response.pipe(
                BufferListStream((error, data) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(data.toString());
                }),
            );
        });
    });

export default readFromUrl;
