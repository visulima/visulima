/* eslint-disable react/function-component-definition, unicorn/filename-case */

/**
 * Spinner component for Ink.
 *
 * Based on ink-spinner by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-spinner
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in the
 * Software without restriction, including without limitation the rights to use, copy,
 * modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import type { SpinnerName } from "cli-spinners";
import spinners from "cli-spinners";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import Text from "./Text";

export type Props = {
    /**
     * Type of a spinner.
     * See [cli-spinners](https://github.com/sindresorhus/cli-spinners) for available spinners.
     * @default "dots"
     */
    readonly type?: SpinnerName;
};

/**
 * Spinner component that renders an animated loading indicator.
 *
 * Uses spinners from [cli-spinners](https://github.com/sindresorhus/cli-spinners).
 */
export default function Spinner({ type = "dots" }: Props): ReactElement {
    const [frame, setFrame] = useState(0);
    const spinner = spinners[type];

    useEffect(() => {
        const timer = setInterval(() => {
            setFrame((previousFrame) => {
                const isLastFrame = previousFrame === spinner.frames.length - 1;

                return isLastFrame ? 0 : previousFrame + 1;
            });
        }, spinner.interval);

        return () => {
            clearInterval(timer);
        };
    }, [spinner]);

    return <Text>{spinner.frames[frame]}</Text>;
}
