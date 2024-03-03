import cn from "clsx";
import type { ImageProps } from "next/image";
import Image from "next/image";
import type { FC } from "react";

import Zoom from "./zoom";

const ImageFrame: FC<ImageProps & { alt: string; caption?: string; full?: boolean; src: string; zoom?: boolean }> = ({
    caption = undefined,
    full = undefined,
    zoom = true,
    ...properties
}) => {
    // TODO: Remove once https://github.com/vercel/next.js/issues/52216 is resolved.
    // `next/image` seems to be affected by a default + named export bundling bug.
    let ResolvedImage = Image;

    if ("default" in ResolvedImage) {
        ResolvedImage = (ResolvedImage as unknown as { default: typeof Image }).default;
    }

    let image = (
        <ResolvedImage
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...properties}
            className={cn("w-auto select-none bg-white rounded-md", full ? "" : "ring-1 ring-gray-200", properties.className)}
        />
    );

    if (zoom) {
        image = <Zoom>{image}</Zoom>;
    }

    return (
        <div
            className={cn(
                "my-6 flex flex-col justify-center overflow-hidden rounded-md border dark:border-zinc-800 not-prose p-2",
                full ? "bg-white" : "bg-zinc-100",
            )}
        >
            {image}
            {caption && (
                <div className="relative mt-3 flex justify-center overflow-auto rounded-xl px-8 pb-2 pt-0 text-sm text-gray-700 dark:text-gray-400">
                    <p>{caption}</p>
                </div>
            )}
        </div>
    );
};

export default ImageFrame;
