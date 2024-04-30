import { existsSync } from "node:fs";

import { join } from "pathe";

const resolveFile = (extensions: string[], resolved: string, index = false) => {
    const fileWithoutExtension = resolved.replace(/\.[jt]sx?$/, "");

    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
    for (const extension of extensions) {
        const file = index ? join(resolved, `index${extension}`) : `${fileWithoutExtension}${extension}`;

        // eslint-disable-next-line security/detect-non-literal-fs-filename
        if (existsSync(file)) {
            return file as string;
        }
    }

    return null;
};

export default resolveFile;
