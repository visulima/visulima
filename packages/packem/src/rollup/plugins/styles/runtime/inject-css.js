/** @type {HTMLElement[]} */
const containers = [];
/** @type {{prepend:HTMLStyleElement,append:HTMLStyleElement}[]} */
const styleTags = [];

/**
 * @param {string} css
 * @param {object} options
 * @param {boolean} [options.prepend]
 * @param {boolean} [options.singleTag]
 * @param {string} [options.container]
 * @param {Record<string,string>} [options.attributes]
 * @returns {void}
 */
export default function (css, options) {
    if (!css || typeof document === "undefined") {
        return;
    }

    const position = options.prepend === true ? "prepend" : "append";
    const singleTag = options.singleTag === true;

    const container = typeof options.container === "string" ? document.querySelector(options.container) : document.querySelectorAll("head")[0];

    function createStyleTag() {
        const styleTag = document.createElement("style");

        styleTag.setAttribute("type", "text/css");

        if (options.attributes) {
            const k = Object.keys(options.attributes);
            for (const element of k) {
                styleTag.setAttribute(element, options.attributes[element]);
            }
        }

        if (typeof __webpack_nonce__ !== "undefined") {
            styleTag.setAttribute("nonce", __webpack_nonce__);
        }

        const pos = position === "prepend" ? "afterbegin" : "beforeend";

        container.insertAdjacentElement(pos, styleTag);

        return styleTag;
    }

    /** @type {HTMLStyleElement} */
    let styleTag;

    if (singleTag) {
        let id = containers.indexOf(container);

        if (id === -1) {
            id = containers.push(container) - 1;
            styleTags[id] = {};
        }

        styleTag = styleTags[id] && styleTags[id][position] ? styleTags[id][position] : (styleTags[id][position] = createStyleTag());
    } else {
        styleTag = createStyleTag();
    }

    // strip potential UTF-8 BOM if css was read from a file
    if (css.charCodeAt(0) === 0xfe_ff) {
        css = css.slice(1);
    }

    if (styleTag.styleSheet) {
        styleTag.styleSheet.cssText += css;
    } else {
        styleTag.append(document.createTextNode(css));
    }
}
