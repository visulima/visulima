import { useContext } from "react";

import type { Props } from "../components/AppContext.js";
import AppContext from "../components/AppContext.js";

/**
 * A React hook that returns app lifecycle methods like `exit()` and `waitUntilRenderFlush()`.
 */
const useApp = (): Props => useContext(AppContext);

export default useApp;
