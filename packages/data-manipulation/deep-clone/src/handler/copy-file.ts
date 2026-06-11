/**
 * Clone a `File` while preserving its `name` and `lastModified` metadata.
 *
 * `Blob.prototype.slice` (used by the Blob handler) drops both, degrading a `File`
 * to a plain `Blob`. Re-constructing via the `File` constructor matches the
 * structured-clone behaviour.
 */
const copyFile = <Value extends File>(file: Value): Value => new File([file], file.name, { lastModified: file.lastModified, type: file.type }) as Value;

export default copyFile;
