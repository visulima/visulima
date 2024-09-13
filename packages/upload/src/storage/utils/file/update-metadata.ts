import merge from "lodash.merge";

import extractOriginalName from "./extract-original-name";
import type File from "./file";

const updateMetadata = <T extends File>(file: T, metadata: Partial<T>): void => {
    // eslint-disable-next-line no-param-reassign
    file = merge(file, metadata);
    // eslint-disable-next-line no-param-reassign
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
};

export default updateMetadata;
