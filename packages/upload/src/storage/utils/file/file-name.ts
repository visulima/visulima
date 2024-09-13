import { isAbsolute } from "node:path";

const FileName: {
    INVALID_CHARS: string[];
    INVALID_PREFIXES: string[];
    INVALID_SUFFIXES: string[];
    MAX_LENGTH: number;
    MIN_LENGTH: number;
    isValid: (name: string) => boolean;
} = {
    INVALID_CHARS: ['"', "*", ":", "<", ">", "?", "\\", "|", "../"],

    INVALID_PREFIXES: [],

    INVALID_SUFFIXES: [],

    MAX_LENGTH: 255,

    MIN_LENGTH: 3,

    isValid(name: string): boolean {
        if (!name || name.length < FileName.MIN_LENGTH || name.length > FileName.MAX_LENGTH || isAbsolute(name)) {
            return false;
        }

        const upperCase = name.toUpperCase();

        return !(
            FileName.INVALID_CHARS.filter(Boolean).some((chars) => upperCase.includes(chars)) ||
            FileName.INVALID_PREFIXES.filter(Boolean).some((chars) => upperCase.startsWith(chars)) ||
            FileName.INVALID_SUFFIXES.filter(Boolean).some((chars) => upperCase.endsWith(chars))
        );
    },
};

export default FileName;
