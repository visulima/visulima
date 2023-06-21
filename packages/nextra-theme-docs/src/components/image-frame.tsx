import cn from "clsx";
import Image from "next/image";
import type { ComponentProps, FC } from "react";
import Zoom from "./zoom";

const ImageFrame: FC<{ src: string; alt: string; full?: boolean; zoom?: boolean; caption?: string } & ComponentProps<typeof Image>> = ({
    full,
    caption,
    zoom = true,
    ...props
}) => {
    let image = <Image className={cn("w-auto select-none bg-white rounded-md", full ? "" : "ring-1 ring-gray-200")} {...props} />;

    if (zoom) {
        image = <Zoom> {image} </Zoom>;
    }

    return (
        <div
            className={cn("my-6 flex flex-col justify-center overflow-hidden rounded-md border dark:border-zinc-800 not-prose p-2", full ? "bg-white" : "bg-zinc-100")}
        >
            {image}
            {caption && <div className="relative rounded-xl overflow-auto flex justify-center mt-3 pt-0 px-8 pb-2 text-sm text-gray-700 dark:text-gray-400"><p>{caption}</p></div>}
        </div>
    );
};

export default ImageFrame;
