// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types,@typescript-eslint/no-explicit-any
const assertValidFileContents = (contents: any): void => {
    if (typeof contents !== "string" && !(contents instanceof ArrayBuffer) && !ArrayBuffer.isView(contents)) {
        throw new TypeError("File contents must be a string, ArrayBuffer, or ArrayBuffer view.");
    }
};

export default assertValidFileContents;
