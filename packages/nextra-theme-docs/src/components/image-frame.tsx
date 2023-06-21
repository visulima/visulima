import cn from "clsx";
import Image from "next/image";
import type { ComponentProps, FC } from "react";

import Zoom from "./zoom";

const ImageFrame: FC<ComponentProps<typeof Image> & { src: string; alt: string; full?: boolean; zoom?: boolean; caption?: string }> = ({
    full,
    caption,
    zoom = true,
    ...properties
}) => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    let image = <Image className={cn("w-auto select-none bg-white rounded-md", full ? "" : "ring-1 ring-gray-200")} {...properties} />;

    if (zoom) {
        image = <Zoom> {image} </Zoom>;
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
