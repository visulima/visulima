import BaseHandler from "../../../src/handler/base-handler";
import type { File } from "../../../src/storage/utils/file";

/**
 * Test helper uploader for testing handler functionality.
 * @extends BaseHandler<File>
 * @public
 */
class TestUploader extends BaseHandler<File> {
    /**
     * Returns an empty list of files.
     * @returns {Promise<File[]>} Promise resolving to an empty array of files
     */
    // eslint-disable-next-line class-methods-use-this
    public override async list(): Promise<File[]> {
        return [];
    }
}

export default TestUploader;
