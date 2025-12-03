const copyBlob = <Value extends Blob>(blob: Value): Value => blob.slice(0, blob.size, blob.type) as Value;

export default copyBlob;
