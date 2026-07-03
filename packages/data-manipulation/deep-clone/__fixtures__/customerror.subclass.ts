/**
 * Creates a CustomError class constructor. Note that we use function generation so that tests may be run in browsers not supporting ES2015 classes. This function may be loaded in non-ES2015 environments, but should only be invoked when ES2015 classes are supported.
 *
 * @returns {Function} constructor
 */
function createClass() {
    /* jshint evil:true */
    var str = "";

    str += "(function create() {";
    str += "class CustomError extends Error {";
    str += "constructor( msg ) {";
    str += "super( msg );";
    str += "}";
    str += "}";
    str += "return CustomError;";
    str += "})()";

    return eval(str);
}

export default createClass;
