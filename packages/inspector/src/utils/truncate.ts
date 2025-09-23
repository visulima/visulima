// eslint-disable-next-line import/no-extraneous-dependencies
import { truncate as stringTruncate } from "@visulima/string";

import { TRUNCATOR } from "../constants";

const truncate = (string: number | string, length: number, tail: typeof TRUNCATOR = TRUNCATOR): string => {
    const stringValue = String(string);

    return stringTruncate(stringValue, length, {
        ellipsis: tail,
    });
};

export default truncate;
