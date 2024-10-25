/** Is the path visible to the calling process? */
export const F_OK = 0; // constants?.F_OK

/** Is the path readable to the calling process? */
export const R_OK = 4; // constants?.R_OK

/** Is the path writable to the calling process? */
export const W_OK = 2; // constants?.W_OK

/** Is the path executable to the calling process? */
export const X_OK = 1; // constants?.X_OK

export const FIND_UP_STOP = Symbol("findUpStop");

export const INTERNAL_STRIP_JSON_REGEX = /"(?:[^"\\]|\\.)*"?|\/\/[^\r\n]*|\/\*(?:[^*]|\*[^/])*(?:\*\/)?/g;
