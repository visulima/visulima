import { useContext } from "react";

import type { Props } from "../components/AppContext";
import AppContext from "../components/AppContext";

/**
 * A React hook that returns app lifecycle methods like `exit()` and `waitUntilRenderFlush()`.
 */
const useApp = (): Props => useContext(AppContext);

export default useApp;
