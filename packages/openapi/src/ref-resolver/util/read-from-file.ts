import { readFileSync } from "node:fs";
import type { URL } from "node:url";
import { fileURLToPath } from "node:url";

import urlNonFragment from "./url-non-fragment";

const readFromFile = async (url: URL): Promise<string> => {
    const fileUrl = urlNonFragment(url);
    const filePath = fileURLToPath(fileUrl);

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return readFileSync(filePath, { encoding: "utf8" });
};

export default readFromFile;
