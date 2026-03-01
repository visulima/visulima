import { createSignal } from "solid-js";

import solidLogo from "./assets/solid.svg";
import "./App.css";

function App() {
    const [count, setCount] = createSignal(0);

    const throwError = () => {
        setTimeout(() => {
            throw new Error("Example error from the SolidJS dev-toolbar demo");
        }, 0);
    };

    const rejectPromise = () => {
        void Promise.reject(new Error("Example unhandled Promise rejection from the SolidJS dev-toolbar demo"));
    };

    return (
        <>
            <div>
                <a href="https://vite.dev" target="_blank">
                    <img src="/vite.svg" class="logo" alt="Vite logo" />
                </a>
                <a href="https://solidjs.com" target="_blank">
                    <img src={solidLogo} class="logo solid" alt="Solid logo" />
                </a>
            </div>
            <h1>Vite + Solid + Dev Toolbar</h1>
            <div class="card">
                <button type="button" onClick={() => setCount((c) => c + 1)}>
                    count is {count()}
                </button>
                <p>
                    Edit <code>src/App.tsx</code> and save to test HMR
                </p>
            </div>
            <div class="card">
                <button type="button" onClick={throwError}>
                    Throw Error
                </button>{" "}
                <button type="button" onClick={rejectPromise}>
                    Unhandled Rejection
                </button>
            </div>
            <p class="read-the-docs">Click on the Vite and Solid logos to learn more</p>
        </>
    );
}

export default App;
