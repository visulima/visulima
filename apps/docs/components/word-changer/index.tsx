import { useEffect, useRef, useState } from "react";

const WordChanger = ({ words }: { words: string[] }): string => {
    const [currentWord, setCurrentWord] = useState(words[0]);
    const [isActive, setIsActive] = useState(true);

    const index = useRef(0);

    useEffect(() => {
        let interval: NodeJS.Timeout | undefined;

        if (isActive) {
            interval = setInterval(() => {
                // eslint-disable-next-line no-plusplus
                index.current++;

                setCurrentWord(words[index.current]);

                if (index.current === words.length - 1) {
                    setIsActive(false);
                }
            }, 2500);
        }

        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    });

    return currentWord;
};

export default WordChanger;
