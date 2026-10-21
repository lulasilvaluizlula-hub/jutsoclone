import { getStore } from '@netlify/blobs';
export function createNetlifyStore(options = {}) {
  const blobs = getStore({ name: 'jutsoclone-accounts', consistency: 'strong', ...options });
  return {
    get: key => blobs.get(key, { type: 'json', consistency: 'strong' }),
    setJSON: (key, value, conditions) => blobs.setJSON(key, value, conditions),
    delete: key => blobs.delete(key),
    async listPrefix(prefix) {
      const keys = [];
      for await (const page of blobs.list({ prefix, paginate: true })) for (const blob of page.blobs) keys.push(blob.key);
      return keys;
    }
  };
}
