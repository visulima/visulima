import copyArrayBuffer from "./copy-array-buffer";

const copyDataView = <Value extends DataView>(dataView: Value): Value => new DataView(copyArrayBuffer(dataView.buffer)) as Value;

export default copyDataView;
