import { existsSync, realpathSync, writeFileSync } from "node:fs";

import readPkgUp from "read-pkg-up";

const initCommand = (configName: string, packageJsonPath = process.cwd()): void => {
    if (existsSync(configName)) {
        throw new Error("Config file already exists");
    }

    const foundPackageJson = readPkgUp.sync({
        cwd: realpathSync(packageJsonPath),
    });

    let exportTemplate = "module.exports =";

    if (foundPackageJson) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { packageJson: package_, path: packagePath } = foundPackageJson;

        // eslint-disable-next-line no-console
        console.info(`Found package.json at "${packagePath as string}"`);

        if (package_.type === "module") {
            // eslint-disable-next-line no-console
            console.info("Found package.json with type: module, using ES6 as export for the config file");

            exportTemplate = "export default";
        }
    } else {
        // eslint-disable-next-line no-console
        console.info("No package.json found");
    }

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

    // eslint-disable-next-line no-console
    console.log(`Created "${configName}"`);
};

export default initCommand;
