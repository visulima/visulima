// eslint-disable-next-line sonarjs/slow-regex
const separatorRegex = /\d(?=(?:\d{3})+(?!\d))/g;
const decimalGroupRegex = /\d{3}/g;
const trailingUnderscoreRegex = /_$/;

const addNumericSeparator = (number_: bigint | number, string_: string): string => {
    // A separator is only inserted once there are four or more consecutive digits.
    // Anything shorter (the overwhelmingly common small-integer case) can therefore
    // skip the regex work entirely. A leading "-" leaves at most three digits.
    if (string_.length < 4 || (string_.length === 4 && string_.codePointAt(0) === 45) /* "-" */) {
        return string_;
    }

    if (number_ === Number.POSITIVE_INFINITY || number_ === Number.NEGATIVE_INFINITY || string_.includes("e")) {
        return string_;
    }

    if (typeof number_ === "number") {
        const int = number_ < 0 ? -Math.floor(-number_) : Math.floor(number_);

        if (int !== number_) {
            const intString = String(int);
            const dec = string_.slice(intString.length + 1);

            return (
                // eslint-disable-next-line unicorn/prefer-string-replace-all
                `${intString.replace(separatorRegex, "$&_")}.${dec.replace(decimalGroupRegex, "$&_").replace(trailingUnderscoreRegex, "")}`
            );
        }
    }

    // eslint-disable-next-line unicorn/prefer-string-replace-all
    return string_.replace(separatorRegex, "$&_");
};

export default addNumericSeparator;
