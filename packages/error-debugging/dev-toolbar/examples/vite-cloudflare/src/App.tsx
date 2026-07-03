import "./App.css";

import { useState } from "react";

import viteLogo from "../../../../../../../../../../../vite.svg";
import reactLogo from "./assets/react.svg";

function App() {
    const [count, setCount] = useState(0);

    const throwError = () => {
        setTimeout(() => {
            const cause = new TypeError("Cannot read properties of undefined (reading 'name')");
            const error = new Error("Example client error thrown from the Cloudflare dev-toolbar demo");

            error.cause = cause;
            throw error;
        }, 0);
    };

    const rejectPromise = () => {
        void Promise.reject(new Error("Example unhandled Promise rejection from the Cloudflare dev-toolbar demo"));
    };

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img alt="Vite logo" className="logo" src={viteLogo} />
                </a>
                <a href="https://react.dev" target="_blank">
                    <img alt="React logo" className="logo react" src={reactLogo} />
                </a>
            </div>
            <h1>Vite + React + Cloudflare + Dev Toolbar</h1>
            <div className="card">
                <button onClick={() => setCount((c) => c + 1)} type="button">
                    count is {count}
                </button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <div className="card">
                <button onClick={throwError} type="button">
                    Throw Error
                </button>{" "}
                <button onClick={rejectPromise} type="button">
                    Unhandled Rejection
                </button>
            </div>
            <p className="read-the-docs">Click on the Vite and React logos to learn more</p>
        </>
    );
}

export default App;
