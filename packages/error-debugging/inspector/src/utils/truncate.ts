import { TRUNCATOR } from "../constants";

const isHighSurrogate = (char: string): boolean => char >= "\uD800" && char <= "\uDBFF";

const truncate = (string: number | string, length: number, tail: typeof TRUNCATOR = TRUNCATOR): string => {
    // eslint-disable-next-line no-param-reassign
    string = String(string);

    const tailLength = tail.length;
    const stringLength = string.length;

    if (tailLength > length && stringLength > tailLength) {
        return tail;
    }

    if (stringLength > length && stringLength > tailLength) {
        let end = length - tailLength;

        if (end > 0 && isHighSurrogate(string[end - 1] as string)) {
            end -= 1;
        }

        return `${string.slice(0, end)}${tail}`;
    }

    return string;
};

export default truncate;
