// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
const assertValidFileOrDirectoryPath = (fileOrDirectoryPath: any): void => {
    if (!fileOrDirectoryPath || (!(fileOrDirectoryPath instanceof URL) && typeof fileOrDirectoryPath !== "string")) {
        throw new TypeError("Path must be a non-empty string or URL.");
    }
};

export default assertValidFileOrDirectoryPath;
