import type { Meta } from "../types";
import getCallerFilename from "../util/get-caller-filename";

const fileProcessor = <L>(meta: Meta<L>): Meta<L> => {
    const { fileName, lineNumber } = getCallerFilename();

    meta.file = {
        line: lineNumber,
        name: fileName,
    };

    return meta;
};

export default fileProcessor;
