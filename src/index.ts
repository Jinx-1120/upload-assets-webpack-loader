import fs from 'node:fs';
import path from 'node:path';
import type { LoaderContext } from 'webpack';
import { getHashDigest } from 'loader-utils';
import { validate } from 'schema-utils';
import mime from 'mime-types';
import schema from './options.json';
import { Schema } from 'schema-utils/declarations/validate';
import { getCache, getCacheForFile, setCache } from './cache';

function isDevMode() {
  return process.env.NODE_ENV === 'development'
}
function shouldTransform(limit: boolean | string | number, size: number) {
  if (typeof limit === 'boolean') {
    return limit;
  }

  if (typeof limit === 'string') {
    return size <= parseInt(limit, 10);
  }

  if (typeof limit === 'number') {
    return size <= limit;
  }

  return true;
}
function getMimetype(mimetype: boolean | string, resourcePath: string) {
  if (typeof mimetype === 'boolean') {
    if (mimetype) {
      const resolvedMimeType = mime.contentType(path.extname(resourcePath));

      if (!resolvedMimeType) {
        return '';
      }

      return resolvedMimeType.replace(/;\s+charset/i, ';charset');
    }

    return '';
  }

  if (typeof mimetype === 'string') {
    return mimetype;
  }

  const resolvedMimeType = mime.contentType(path.extname(resourcePath));

  if (!resolvedMimeType) {
    return '';
  }

  return resolvedMimeType.replace(/;\s+charset/i, ';charset');
}
function getEncoding(encoding: boolean | BufferEncoding): BufferEncoding {
  if (typeof encoding === 'boolean') {
    return encoding ? 'base64' : ('' as BufferEncoding);
  }

  if (typeof encoding === 'string') {
    return encoding;
  }

  return 'base64';
}
function getEncodedData(
  generator: Function,
  mimetype: string,
  encoding: BufferEncoding,
  content: Buffer,
  resourcePath: string
) {
  if (generator) {
    return generator(content, mimetype, encoding, resourcePath);
  }
  const buffer = fs.readFileSync(resourcePath);
  return `data:${mimetype};base64,${buffer.toString('base64')}`;
}

interface IOptions {
  limit: boolean | string | number;
  mimetype: boolean | string;
  encoding: boolean | BufferEncoding;
  generator: Function;
  uploadRequest: (fileBuffer: fs.ReadStream, fileName: string, resourcePath: string) => Promise<string>;
  fallback: string;
  esModule: boolean;
}
const DEFAULT_OPTION = {
  limit: true,
  mimetype: true,
  encoding: 'base64',
  fallback: 'file-loader',
  esModule: true,
};

function uploadAssetsLoader(this: LoaderContext<any>, content: Buffer) {
  const options: IOptions = { ...DEFAULT_OPTION, ...this.getOptions() };
  validate(schema as Schema, options, {
    name: 'URL Loader',
    baseDataPath: 'options',
  });
  const esModule = typeof options.esModule !== 'undefined' ? options.esModule : true;
  const { resourcePath, rootContext } = this;
  const callback = this.async();
  const fileMd5 = getHashDigest(content, 'md5', 'hex', 9999);
  getCacheForFile(rootContext);
  const cacheUrl = getCache(fileMd5);
  if (cacheUrl && isDevMode()) {
    callback(null, `${esModule ? 'export default' : 'module.exports ='} '${cacheUrl}';`);
    return;
  }
  if (shouldTransform(options.limit, content.length)) {
    const mimetype = getMimetype(options.mimetype, resourcePath);
    const encoding = getEncoding(options.encoding);
    const encodedData = getEncodedData(options.generator, mimetype, encoding, content, resourcePath);
    isDevMode() && setCache(fileMd5, encodedData);
    callback(null, `${esModule ? 'export default' : 'module.exports ='} ${JSON.stringify(encodedData)}`);
    return;
  }
  const { uploadRequest } = options;

  if (!uploadRequest) {
    throw new Error(`uploadRequest is required`);
  }
  uploadRequest(fs.createReadStream(resourcePath), path.basename(resourcePath), resourcePath).then((url) => {
    isDevMode() && setCache(fileMd5, url);
    callback(null, `${esModule ? 'export default' : 'module.exports ='} '${url}';`);
  });
}

export default uploadAssetsLoader;
export const row = true;
