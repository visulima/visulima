import cn from "clsx";
import Image from "next/image";
import type { FC } from "react";
import { Zoom } from "@visulima/nextra-theme-docs";

const Screenshot: FC<{ alt: string; full: boolean, src: string; }> = ({ alt, full, src }) => (
    <div className={cn("-mb-4 mt-6 flex justify-center overflow-hidden rounded-xl border dark:border-zinc-800", full ? "bg-white" : "bg-zinc-100")}>
        <Zoom>
            <Image src={src} alt={alt} className={cn("w-auto select-none bg-white", full ? "" : "ring-1 ring-gray-200")} />
        </Zoom>
    </div>
);

export default Screenshot;
