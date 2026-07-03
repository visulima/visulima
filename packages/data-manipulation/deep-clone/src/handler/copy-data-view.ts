import copyArrayBuffer from "./copy-array-buffer";

const copyDataView = <Value extends DataView>(dataView: Value): Value => {
    const { buffer } = dataView;

    if (buffer instanceof SharedArrayBuffer) {
        throw new TypeError("SharedArrayBuffer cannot be cloned");
    }

    const copiedBuffer = copyArrayBuffer(buffer);

    return new DataView(copiedBuffer, dataView.byteOffset, dataView.byteLength) as Value;
};

export default copyDataView;
