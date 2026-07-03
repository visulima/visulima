/**
 * Modified copy of https://github.com/chalk/chalk-template/blob/main/index.js
 *
 * MIT License
 *
 * Copyright (c) Josh Junon
 * Copyright (c) Sindre Sorhus &lt;sindresorhus@gmail.com> (https://sindresorhus.com)
 */

// prettier-ignore
// eslint-disable-next-line import/prefer-default-export -- public API uses named export
export const makeColorizeTemplate = (template: (text: string) => string): (firstString: TemplateStringsArray, ...arguments_: any[]) => string =>

    (firstString: TemplateStringsArray, ...arguments_: any[]): string => {
        if (!Array.isArray(firstString) || !Array.isArray(firstString.raw)) {
            // If chalkTemplate() was called by itself or with a string
            throw new TypeError("A tagged template literal must be provided");
        }

        const parts = [firstString.raw[0]];

        for (let index = 1; index < firstString.raw.length; index += 1) {
            parts.push(String(arguments_[index - 1]).replaceAll(/[{}\\]/g, String.raw`\$&`), String(firstString.raw[index]));
        }

        return template(parts.join(""));
    };
