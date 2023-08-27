import type { FC, SVGAttributes } from "react";

const RIcon: FC<SVGAttributes<SVGElement>> = (properties = {}) => (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <svg preserveAspectRatio="xMidYMid" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" {...properties}>
        <defs>
            <linearGradient
                gradientTransform="matrix(.2169 0 0 .14527 -.16 14.112)"
                gradientUnits="userSpaceOnUse"
                id="r-original-a"
                x1=".741"
                x2="590.86"
                y1="3.666"
                y2="593.79"
            >
                <stop offset="0" stopColor="#cbced0" />
                <stop offset="1" stopColor="#84838b" />
            </linearGradient>
            <linearGradient
                gradientTransform="matrix(.17572 0 0 .17931 -.16 14.112)"
                gradientUnits="userSpaceOnUse"
                id="r-original-b"
                x1="301.03"
                x2="703.07"
                y1="151.4"
                y2="553.44"
            >
                <stop offset="0" stopColor="#276dc3" />
                <stop offset="1" stopColor="#165caa" />
            </linearGradient>
        </defs>
        <path
            d="M64 100.38c-35.346 0-64-19.19-64-42.863 0-23.672 28.654-42.863 64-42.863s64 19.19 64 42.863c0 23.672-28.654 42.863-64 42.863zm9.796-68.967c-26.866 0-48.646 13.119-48.646 29.303 0 16.183 21.78 29.303 48.646 29.303s46.693-8.97 46.693-29.303c0-20.327-19.827-29.303-46.693-29.303z"
            fill="url(#r-original-a)"
            fillRule="evenodd"
        />
        <path
            d="M97.469 81.033s3.874 1.169 6.124 2.308c.78.395 2.132 1.183 3.106 2.219a8.388 8.388 0 011.42 2.04l15.266 25.74-24.674.01-11.537-21.666s-2.363-4.06-3.817-5.237c-1.213-.982-1.73-1.331-2.929-1.331h-5.862l.004 28.219-21.833.009V41.26h43.844s19.97.36 19.97 19.359c0 18.999-19.082 20.413-19.082 20.413zm-9.497-24.137l-13.218-.009-.006 12.258 13.224-.005s6.124-.019 6.124-6.235c0-6.34-6.124-6.009-6.124-6.009z"
            fill="url(#r-original-b)"
            fillRule="evenodd"
        />
    </svg>
);

export default RIcon;
