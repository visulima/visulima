type FormatterFunction = (argument: any) => string;
type FormatterMap = Record<number, FormatterFunction>;

interface Options {
    formatters?: Record<string, FormatterFunction>;
    stringify?: (o: any) => string;
}

const tryStringify = (o: any): string => {
    try {
        return JSON.stringify(o);
    } catch {
        return '"[Circular]"';
    }
};

const CHAR_PERCENT = "%".charCodeAt(0);
const CHAR_s = "s".charCodeAt(0);
const CHAR_d = "d".charCodeAt(0);
const CHAR_f = "f".charCodeAt(0);
const CHAR_i = "i".charCodeAt(0);
const CHAR_O = "O".charCodeAt(0);
const CHAR_o = "o".charCodeAt(0);
const CHAR_j = "j".charCodeAt(0);

export const format = (f: object | string | null, arguments_: any[] = [], options: Options = {}): any => {
    const stringify = options?.stringify || tryStringify;
    const offset = 1;

    if (typeof f === "object" && f !== null) {
        const length_ = arguments_.length + offset;

        if (length_ === 1) {
            return f;
        }

        const objects = new Array(length_);

        objects[0] = stringify(f);

        for (let index = 1; index < length_; index++) {
            objects[index] = stringify(arguments_[index - offset]);
        }

        return objects.join(" ");
    }

    if (typeof f !== "string" || arguments_.length === 0) {
        return f;
    }

    let string_ = "";
    let a = 1 - offset;
    let lastPos = -1;

    const flen = (f && f.length) || 0;

    for (let index = 0; index < flen; ) {
        if (f.charCodeAt(index) === CHAR_PERCENT && index + 1 < flen) {
            lastPos = lastPos > -1 ? lastPos : 0;

            const c = f.charCodeAt(index + 1);

            switch (c) {
                case CHAR_d:
                case CHAR_f: {
                    if (a >= arguments_.length || arguments_[a] == null) {
                        break;
                    }

                    if (lastPos < index) {
                        string_ += f.slice(lastPos, index);
                    }

                    string_ += Number(arguments_[a]).toString();
                    lastPos = index + 2;

                    index++;
                    break;
                }
                case CHAR_i: {
                    if (a >= arguments_.length || arguments_[a] == null) {
                        break;
                    }

                    if (lastPos < index) {
                        string_ += f.slice(lastPos, index);
                    }

                    string_ += Math.floor(Number(arguments_[a])).toString();
                    lastPos = index + 2;

                    index++;
                    break;
                }
                case CHAR_O:
                case CHAR_o:
                case CHAR_j: {
                    if (a >= arguments_.length || arguments_[a] === undefined) {
                        break;
                    }

                    if (lastPos < index) {
                        string_ += f.slice(lastPos, index);
                    }

                    const type = typeof arguments_[a];

                    if (type === "string") {
                        string_ += `'${arguments_[a]}'`;
                        lastPos = index + 2;
                        break;
                    }
                    if (type === "function") {
                        string_ += arguments_[a].name || "<anonymous>";
                        lastPos = index + 2;
                        break;
                    }

                    string_ += stringify(arguments_[a]);
                    lastPos = index + 2;

                    index++;
                    break;
                }
                case CHAR_s: {
                    if (a >= arguments_.length) {
                        break;
                    }

                    if (lastPos < index) {
                        string_ += f.slice(lastPos, index);
                    }

                    string_ += typeof arguments_[a] === "object" ? stringify(arguments_[a]) : String(arguments_[a]);
                    lastPos = index + 2;

                    index++;
                    break;
                }
                case CHAR_PERCENT: {
                    if (lastPos < index) {
                        string_ += f.slice(lastPos, index);
                    }

                    string_ += "%";
                    lastPos = index + 2;

                    index++;
                    a--;
                    break;
                }
            }

            if (typeof options?.formatters?.[c] === "function") {
                string_ += (options.formatters[c] as FormatterFunction)(arguments_[a]);
                lastPos = index + 2;
            }

            ++a;
        }

        ++index;
    }

    if (lastPos === -1) {
        return f;
    }

    if (lastPos < flen) {
        string_ += f.slice(lastPos);
    }

    return string_;
};

export const build = (options: Options = {}) => {
    const formatters: FormatterMap = {};

    if (typeof options.formatters === "object") {
        Object.entries(options.formatters).forEach(([key, formatterFunc]) => {
            if (key.length > 1) {
                throw new Error(`Formatter %${key} has more than one character`);
            }

            if (typeof formatterFunc !== "function") {
                throw new TypeError(`Formatter for %${key} is not a function`);
            }

            const c = key.charCodeAt(0);

            formatters[c] = formatterFunc;
        });
    }

    return (f: any, arguments_: any[], options?: Omit<Options, "formatters">) => format(f, arguments_, { ...options, formatters });
};
