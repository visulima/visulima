import { describe, expect, it } from "vitest";

import SupabaseFile from "../../../src/storage/supabase/supabase-file";

describe(SupabaseFile, () => {
    it("should expose Supabase-specific properties", () => {
        expect.assertions(3);

        const file = new SupabaseFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        file.bucket = "avatars";
        file.path = "folder/test.mp4";
        file.publicUrl = "https://example.supabase.co/storage/v1/object/public/avatars/folder/test.mp4";

        expect(file.bucket).toBe("avatars");
        expect(file.path).toBe("folder/test.mp4");
        expect(file.publicUrl).toBe("https://example.supabase.co/storage/v1/object/public/avatars/folder/test.mp4");
    });

    it("should extend the File base class", () => {
        expect.assertions(1);

        const file = new SupabaseFile({ contentType: "video/mp4", metadata: { foo: "bar" }, originalName: "test.mp4" });

        expect(file).toHaveProperty("metadata");
    });
});
