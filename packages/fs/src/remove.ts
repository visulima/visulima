import { rm, unlink } from "node:fs/promises";

import assertValidFileOrDirectoryPath from "./utils/assert-valid-file-or-directory-path";

const remove = async (
    path: URL | string,
    options: {
        /**
         * If an `EBUSY`, `EMFILE`, `ENFILE`, `ENOTEMPTY`, or
         * `EPERM` error is encountered, Node.js will retry the operation with a linear
         * backoff wait of `retryDelay` ms longer on each try. This option represents the
         * number of retries. This option is ignored if the `recursive` option is not
         * `true`.
         * @default 0
         */
        maxRetries?: number | undefined;
        /**
         * The amount of time in milliseconds to wait between retries.
         * This option is ignored if the `recursive` option is not `true`.
         * @default 100
         */
        retryDelay?: number | undefined;
    } = {},
): Promise<void> => {
    assertValidFileOrDirectoryPath(path);

    try {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        await unlink(path);
    } catch {
        /* empty */
    }

    try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        await rm(path, { force: true, maxRetries: options?.maxRetries, recursive: true, retryDelay: options?.retryDelay });
    } catch {
        /* empty */
    }
};

export default remove;
