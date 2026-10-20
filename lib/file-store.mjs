import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
export function createFileStore(directory) {
  const file = key => path.join(directory, createHash('sha256').update(key).digest('hex') + '.json');
  return {
    async get(key) { try { return JSON.parse(await readFile(file(key), 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } },
    async setJSON(key, value, { onlyIfNew = false } = {}) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      if (onlyIfNew) { try { await writeFile(file(key), JSON.stringify(value), { flag: 'wx', mode: 0o600 }); return { modified: true }; } catch (error) { if (error.code === 'EEXIST') return { modified: false }; throw error; } }
      const temporary = file(key) + '.' + randomBytes(8).toString('hex');
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
      await rename(temporary, file(key)); return { modified: true };
    },
    async delete(key) { try { await unlink(file(key)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  };
}
