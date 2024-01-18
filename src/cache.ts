import fs from 'node:fs';
import path from 'node:path';
import * as mkdirp from 'mkdirp';

const CACHE_DIR = '/node_modules/.cache/.upload-assets-cache';
let rootPath = '';

export const CacheStore = new Map<string, string>();
export const getCacheForFile = (p: string) => {
  if (CacheStore.size > 0) return;
  rootPath = p;
  const dir = rootPath + CACHE_DIR;
  if (fs.existsSync(dir)) {
    const content = fs.readFileSync(dir, { encoding: 'utf8' });
    content.split('\n').forEach((text) => {
      if (text.includes('|&&|')) {
        const [key, value] = text.split('|&&|');
        CacheStore.set(key, value);
      }
    });
  } else {
    mkdirp.sync(path.dirname(dir));
  }
  return CacheStore;
};

export const setCache = (key: string, value: string) => {
  if (!CacheStore.has(key)) {
    CacheStore.set(key, value);
    const dir = rootPath + CACHE_DIR;
    fs.appendFile(dir, `${key}|&&|${value}\n`, 'utf-8', () => {});
  }
};

export const getCache = (key: string) => {
  return CacheStore.get(key);
};
