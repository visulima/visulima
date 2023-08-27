import type { FC, SVGAttributes } from "react";

const KotlinIcon: FC<SVGAttributes<SVGElement>> = (properties = {}) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" {...properties}>
        <linearGradient gradientUnits="userSpaceOnUse" id="kotlin-original-a" x1="-11.899" x2="40.299" y1="48.694" y2="-8.322">
            <stop offset="0" stopColor="#1c93c1" />
            <stop offset=".163" stopColor="#2391c0" />
            <stop offset=".404" stopColor="#378bbe" />
            <stop offset=".696" stopColor="#587eb9" />
            <stop offset=".995" stopColor="#7f6cb1" />
        </linearGradient>
        <path d="M0 0h65.4L0 64.4z" fill="url(#kotlin-original-a)" />
        <linearGradient gradientUnits="userSpaceOnUse" id="kotlin-original-b" x1="43.553" x2="95.988" y1="149.174" y2="94.876">
            <stop offset="0" stopColor="#1c93c1" />
            <stop offset=".216" stopColor="#2d8ebf" />
            <stop offset=".64" stopColor="#587eb9" />
            <stop offset=".995" stopColor="#7f6cb1" />
        </linearGradient>
        <path d="M128 128L64.6 62.6 0 128z" fill="url(#kotlin-original-b)" />
        <linearGradient gradientUnits="userSpaceOnUse" id="kotlin-original-c" x1="3.24" x2="92.481" y1="95.249" y2="2.116">
            <stop offset="0" stopColor="#c757a7" />
            <stop offset=".046" stopColor="#ca5a9e" />
            <stop offset=".241" stopColor="#d66779" />
            <stop offset=".428" stopColor="#e17357" />
            <stop offset=".6" stopColor="#e97c3a" />
            <stop offset=".756" stopColor="#ef8324" />
            <stop offset=".888" stopColor="#f28817" />
            <stop offset=".982" stopColor="#f48912" />
        </linearGradient>
        <path d="M0 128L128 0H64.6L0 63.7z" fill="url(#kotlin-original-c)" />
    </svg>
);

export default KotlinIcon;
