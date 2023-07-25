import { existsSync, realpathSync, writeFileSync } from "node:fs";
import readPkgUp from "read-pkg-up";

const initCommand = (configName: string, packageJsonPath = process.cwd()): void => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (existsSync(configName)) {
        throw new Error("Config file already exists");
    }

    const foundPackageJson = readPkgUp.sync({
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        cwd: realpathSync(packageJsonPath),
    });

    let exportTemplate = "module.exports =";

    if (foundPackageJson) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { packageJson: package_, path: packagePath } = foundPackageJson;

        console.info(`Found package.json at "${packagePath}"`);

        if (package_["type"] === "module") {
            console.info("Found package.json with type: module, using ES6 as export for the config file");

            exportTemplate = "export default";
        }
    } else {
        console.info("No package.json found");
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(
        configName,
        `${exportTemplate} {
  exclude: [
    'coverage/**',
    '.github/**',
    'packages/*/test{,s}/**',
    '**/*.d.ts',
    'test{,s}/**',
    'test{,-*}.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}',
    '**/*{.,-}test.{js,cjs,mjs,ts,tsx,jsx,yaml,yml}',
    '**/__tests__/**',
    '**/{ava,babel,nyc}.config.{js,cjs,mjs}',
    '**/jest.config.{js,cjs,mjs,ts}',
    '**/{karma,rollup,webpack}.config.js',
    '**/.{eslint,mocha}rc.{js,cjs}',
    '**/.{travis,yarnrc}.yml',
    '**/{docker-compose,docker}.yml',
    '**/.yamllint.{yaml,yml}',
    '**/node_modules/**',
    '**/pnpm-lock.yaml',
    '**/pnpm-workspace.yaml',
    '**/{package,package-lock}.json',
    '**/yarn.lock',
    '**/package.json5',
    '**/.next/**',
  ],
  followSymlinks: false,
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'API',
      version: '1.0.0',
    },
  },
};
`,
    );

    console.log(`Created "${configName}"`);
};

export default initCommand;
