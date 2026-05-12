import { File } from "../utils/file";

class GoogleDriveFile extends File {
    public driveFileId?: string;

    public mimeType?: string;

    public publicUrl?: string;
}

export default GoogleDriveFile;
