import BaseHandler from "../../../src/handler/base-handler";
import { File } from "../../../src/storage/utils/file";

class TestUploader extends BaseHandler<File> {
    // eslint-disable-next-line class-methods-use-this
    public async list(): Promise<File[]> {
        return [];
    }
}

export default TestUploader;
