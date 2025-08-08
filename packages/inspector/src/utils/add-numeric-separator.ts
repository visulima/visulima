const addNumericSeparator = (number_: bigint | number, string_: string): string => {
    if (number_ === Number.POSITIVE_INFINITY || number_ === Number.NEGATIVE_INFINITY || string_.includes("e")) {
        return string_;
    }

    // eslint-disable-next-line sonarjs/slow-regex
    const separatorRegex = /\d(?=(?:\d{3})+(?!\d))/g;

    if (typeof number_ === "number") {
        const int = number_ < 0 ? -Math.floor(-number_) : Math.floor(number_);

        if (int !== number_) {
            const intString = String(int);
            const dec = string_.slice(intString.length + 1);

            return (
                // eslint-disable-next-line unicorn/prefer-string-replace-all
                `${intString.replace(separatorRegex, "$&_")}.${dec.replace(/\d{3}/g, "$&_").replace(/_$/, "")}`
            );
        }
    }

    // eslint-disable-next-line unicorn/prefer-string-replace-all
    return string_.replace(separatorRegex, "$&_");
};

export default addNumericSeparator;
