import BaseHandler from "../../../src/handler/base-handler";
import type { File } from "../../../src/storage/utils/file";

class TestUploader extends BaseHandler<File> {
    // eslint-disable-next-line class-methods-use-this
    public override async list(): Promise<File[]> {
        return [];
    }
}

export default TestUploader;
