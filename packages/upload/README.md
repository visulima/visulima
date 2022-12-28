<div align="center">
  <h3>Visulima upload</h3>
  <p>Visulima upload copies files to a web-accessible location and provides a consistent way to get the URLs that correspond to those files.</p>
  <p>Visulima upload can also resize, crop and autorotate uploaded images.</p>
  <p>Visulima upload includes S3-based, Azure-based, GCS-based and local filesystem-based backends and you may supply others.</p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

<div align="center">
  <sub>Built with ❤︎ by <a href="https://twitter.com/_prisis_">Daniel Bannert</a></sub>
</div>

## Features

- Parent directories are created automatically as needed (like S3 and Azure)
- Content types are inferred from file extensions (like the filesystem)
- Files are by default marked as readable via the web (like a filesystem + web server)
- Images can be automatically scaled to multiple sizes
- Images can be cropped
- Images are automatically rotated if necessary for proper display on the web (i.e. iPhone photos with rotation hints are right side up)
- Image width, image height and correct file extension are made available to the developer
- Non-image files are also supported
- Web access to files can be disabled and reenabled
- GIF is supported, including animation, with full support for scaling and cropping
- On fire about minimizing file sizes for your resized images? You can plug in `imagemin` and compatible tools using the `postprocessors` option.

## Installation

```sh
npm install @visulima/upload
```

```sh
yarn add @visulima/upload
```

```sh
pnpm add @visulima/upload
```

## Install requirements peer storage

### AWS S3

```sh
npm install @aws-sdk/abort-controller @aws-sdk/client-s3 @aws-sdk/credential-providers @aws-sdk/s3-request-presigner @aws-sdk/signature-v4-crt aws-crt
```

```sh
yarn add @aws-sdk/abort-controller @aws-sdk/client-s3 @aws-sdk/credential-providers @aws-sdk/s3-request-presigner @aws-sdk/signature-v4-crt aws-crt
```

```sh
pnpm add @aws-sdk/abort-controller @aws-sdk/client-s3 @aws-sdk/credential-providers @aws-sdk/s3-request-presigner @aws-sdk/signature-v4-crt aws-crt
```

### Azure Blob Storage

```sh
npm install @azure/storage-blob abort-controller
```

```sh
yarn add @azure/storage-blob abort-controller
```

```sh
pnpm add @azure/storage-blob abort-controller
```

### Google Cloud Storage

```sh
npm install @google-cloud/storage abort-controller
```

```sh
yarn add @google-cloud/storage abort-controller
```

```sh
pnpm add @google-cloud/storage abort-controller
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima uploads is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/upload?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/upload/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/upload/v/latest "npm"
