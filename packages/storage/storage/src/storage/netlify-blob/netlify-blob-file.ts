import { File } from "../utils/file";

class NetlifyBlobFile extends File {
    /**
     * @deprecated Never set: Netlify Blobs has no public URL. Serve blobs through your handler's `GET`.
     */
    public url?: string;

    /**
     * The blob's pathname within the store
     */
    public pathname?: string;
}

export default NetlifyBlobFile;
