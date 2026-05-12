import { File } from "../utils/file";

class OneDriveFile extends File {
    public driveItemId?: string;

    public eTag?: string;

    public webUrl?: string;
}

export default OneDriveFile;
