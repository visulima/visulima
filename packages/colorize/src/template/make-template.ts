const TEMPLATE_REGEX =
    /(?:\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.))|(?:{(~)?(#?[\w:]+(?:\([^)]*\))?(?:\.#?[\w:]+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(})|((?:.|[\r\n\f])+?)/gi;
const STYLE_REGEX = /(?:^|\.)(?:(?:(\w+)(?:\(([^)]*)\))?)|(?:#(?=[:a-fA-F\d]{2,})([a-fA-F\d]{6})?(?::([a-fA-F\d]{6}))?))/g;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.)|([^\\])/gi;

function parseArguments(name, arguments_) {
    const results = [];
    const chunks = arguments_.trim().split(/\s*,\s*/g);
    let matches;

    for (const chunk of chunks) {
        const number = Number(chunk);

        if (!Number.isNaN(number)) {
            results.push(number);
        } else if ((matches = chunk.match(STRING_REGEX))) {
            results.push(matches[2].replace(ESCAPE_REGEX, (_, escape, character) => (escape ? unescape(escape) : character)));
        } else {
            throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
        }
    }

    return results;
}

function parseHex(hex) {
    const n = Number.parseInt(hex, 16);
    return [
        // eslint-disable-next-line no-bitwise
        (n >> 16) & 0xff,
        // eslint-disable-next-line no-bitwise
        (n >> 8) & 0xff,
        // eslint-disable-next-line no-bitwise
        n & 0xff,
    ];
}

function parseStyle(style) {
    STYLE_REGEX.lastIndex = 0;

    const results = [];
    let matches;

    while ((matches = STYLE_REGEX.exec(style)) !== null) {
        const name = matches[1];

        if (matches[2]) {
            results.push([name, ...parseArguments(name, matches[2])]);
        } else if (matches[3] || matches[4]) {
            if (matches[3]) {
                results.push(["rgb", ...parseHex(matches[3])]);
            }

            if (matches[4]) {
                results.push(["bgRgb", ...parseHex(matches[4])]);
            }
        } else {
            results.push([name]);
        }
    }

    return results;
}

export function makeTemplate(chalk) {
    function buildStyle(styles) {
        const enabled = {};

        for (const layer of styles) {
            for (const style of layer.styles) {
                enabled[style[0]] = layer.inverse ? null : style.slice(1);
            }
        }

        let current = chalk;

        for (const [styleName, styles] of Object.entries(enabled)) {
            if (!Array.isArray(styles)) {
                continue;
            }

            if (!(styleName in current)) {
                throw new Error(`Unknown Chalk style: ${styleName}`);
            }

            current = styles.length > 0 ? current[styleName](...styles) : current[styleName];
        }

        return current;
    }

    function template(string) {
        const styles = [];
        const chunks = [];
        let chunk = [];

        // eslint-disable-next-line max-params
        string.replace(TEMPLATE_REGEX, (_, escapeCharacter, inverse, style, close, character) => {
            if (escapeCharacter) {
                chunk.push(unescape(escapeCharacter));
            } else if (style) {
                const string = chunk.join("");
                chunk = [];
                chunks.push(styles.length === 0 ? string : buildStyle(styles)(string));
                styles.push({ inverse, styles: parseStyle(style) });
            } else if (close) {
                if (styles.length === 0) {
                    throw new Error("Found extraneous } in Chalk template literal");
                }

                chunks.push(buildStyle(styles)(chunk.join("")));
                chunk = [];
                styles.pop();
            } else {
                chunk.push(character);
            }
        });

        chunks.push(chunk.join(""));

        if (styles.length > 0) {
            throw new Error(`Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? "" : "s"} (\`}\`)`);
        }

        return chunks.join("");
    }

    return template;
}
