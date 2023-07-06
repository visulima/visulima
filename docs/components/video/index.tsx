import type { FC } from "react";

const Video: FC<{ src: string }> = ({ src }) => (
    <video autoPlay className="mt-6 rounded-xl border dark:border-zinc-800" controls loop muted playsInline>
        <source src={src} type="video/mp4" />
    </video>
);

export default Video;
