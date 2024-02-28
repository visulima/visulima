// prettier-ignore
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeColorizeTemplate = (template: (text: string) => string): ((firstString: TemplateStringsArray, ...arguments_: any[]) => string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (firstString: TemplateStringsArray, ...arguments_: any[]): string => {
        if (!Array.isArray(firstString) || !Array.isArray(firstString.raw)) {
            // If chalkTemplate() was called by itself or with a string
            throw new TypeError("A tagged template literal must be provided");
        }

        const parts = [firstString.raw[0]];

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 1; index < firstString.raw.length; index++) {
            parts.push(String(arguments_[index - 1]).replaceAll(/[{}\\]/g, "\\$&"), String(firstString.raw[index]));
        }

        return template(parts.join(""));
    };
