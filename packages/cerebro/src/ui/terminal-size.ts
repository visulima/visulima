
import termSize from "term-size";

const terminalSize = (): {
    height: number;
    width: number;
} => {
    const { columns, rows } = termSize();

    return {
        height: rows,
        width: columns,
    };
};

export default terminalSize;
