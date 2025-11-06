/**
 * Modified copy of https://github.com/chalk/chalk-template/blob/main/index.js
 *
 * MIT License
 *
 * Copyright (c) Josh Junon
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

// prettier-ignore

export const makeColorizeTemplate = (template: (text: string) => string): (firstString: TemplateStringsArray, ...arguments_: any[]) => string =>

    (firstString: TemplateStringsArray, ...arguments_: any[]): string => {
        if (!Array.isArray(firstString) || !Array.isArray(firstString.raw)) {
            // If chalkTemplate() was called by itself or with a string
            throw new TypeError("A tagged template literal must be provided");
        }

        const parts = [firstString.raw[0]];

        // eslint-disable-next-line no-loops/no-loops,no-plusplus
        for (let index = 1; index < firstString.raw.length; index++) {
            // eslint-disable-next-line security/detect-object-injection
            parts.push(String(arguments_[index - 1]).replaceAll(/[{}\\]/g, String.raw`\$&`), String(firstString.raw[index]));
        }

        return template(parts.join(""));
    };
