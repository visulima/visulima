import { useContext } from "react";

import type { Props } from "../../components/app-context";
import AppContext from "../../components/app-context";

/**
 * A React hook that returns app lifecycle methods like `exit()` and `waitUntilRenderFlush()`.
 */
const useApp = (): Props => useContext(AppContext);

export default useApp;

export { useApp };
export type { Props as AppProps } from "../../components/app-context";
