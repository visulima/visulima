const functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*/)]+\*\/\s*)*([^\s(/]+)/;
const maxFunctionSourceLength = 512;

/** *
 * Returns the name of a function.
 * When a non-function instance is passed, returns `null`.
 * This also includes a polyfill function if `aFunc.name` is not defined.
 */

// eslint-disable-next-line @typescript-eslint/ban-types
const getFunctionName = (aFunction: Function): string | null => {
    if (typeof aFunction !== "function") {
        return null;
    }

    let name = "";

    if (Function.prototype.name === undefined && aFunction.name === undefined) {
        // Here we run a polyfill if Function does not support the `name` property and if aFunc.name is not defined

        const functionSource = Function.prototype.toString.call(aFunction);
        // To avoid unconstrained resource consumption due to pathologically large function names,
        // we limit the available return value to be less than 512 characters.
        if (functionSource.indexOf("(") > maxFunctionSourceLength) {
            return name;
        }
        const match = functionNameMatch.exec(Function.prototype.toString.call(aFunction));
        if (match) {
            [name] = match;
        }
    } else {
        // If we've got a `name` property we just use it
        name = aFunction.name;
    }

    return name;
}

export default getFunctionName;
