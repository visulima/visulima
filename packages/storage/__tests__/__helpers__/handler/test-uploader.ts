import { BaseHandlerNode } from "../../../src/handler/base/base-handler-node";
import type { File } from "../../../src/storage/utils/file";

/**
 * Test helper uploader for testing handler functionality.
 * @augments BaseHandlerNode<File>
 * @public
 */
class TestUploader extends BaseHandlerNode<File> {
    /**
     * Compose and register HTTP method handlers.
     */
    protected compose(): void {
        this.registeredHandlers.set("GET", this.get.bind(this));
        this.registeredHandlers.set("OPTIONS", this.options.bind(this));
        this.registeredHandlers.set("DOWNLOAD", this.download.bind(this));
    }

    /**
     * Returns an empty list of files.
     * @returns Promise resolving to an empty array of files
     */
    // eslint-disable-next-line class-methods-use-this
    public override async list(): Promise<File[]> {
        return [];
    }
}

export default TestUploader;
