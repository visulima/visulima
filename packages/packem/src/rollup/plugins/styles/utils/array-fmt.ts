export default (array: string[]): string =>
    array
        .map((id, index, array_) => {
            const fmt = `\`${id}\``;
            switch (index) {
                case array_.length - 1: {
                    return `or ${fmt}`;
                }
                case array_.length - 2: {
                    return fmt;
                }
                default: {
                    return `${fmt},`;
                }
            }
        })
        .join(" ");
