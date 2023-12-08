interface ElectronProcess extends NodeJS.Process {
    defaultApp?: boolean;
    versions: NodeJS.ProcessVersions & {
        electron: string;
    };
}

// process.versions.electron is either set by electron, or undefined
// see https://github.com/electron/electron/blob/master/docs/api/process.md#processversionselectron-readonly
const isElectronApp = (): boolean => !!(process as ElectronProcess).versions.electron;

// process.defaultApp is either set by electron in an electron unbundled app, or undefined
// see https://github.com/electron/electron/blob/master/docs/api/process.md#processdefaultapp-readonly
const isBundledElectronApp = (): boolean => isElectronApp() && !(process as ElectronProcess).defaultApp;

const getProcessArgvBinIndex = (): number => {
    // The binary name is the first command line argument for:
    // - bundled Electron apps: bin argv1 argv2 ... argvn
    if (isBundledElectronApp()) {
        return 0;
    }

    // or the second one (default) for:
    // - standard node apps: node bin argv1 argv2 ... argvn
    // - unbundled Electron apps: electron bin argv1 arg2 ... argvn
    return 1;
};

const hideBin = (argv: string[]): string[] => argv.slice(getProcessArgvBinIndex() + 1);

export default hideBin;
