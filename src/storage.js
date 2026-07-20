// Standalone stand-in for Claude's artifact `window.storage` API, backed by
// the browser's localStorage instead. Same method shapes (get/set/delete),
// so the app code that talks to it didn't need to change.
const PREFIX = "property-ledger:";

export const storage = {
  async get(key) {
    const value = localStorage.getItem(PREFIX + key);
    if (value === null) throw new Error(`Key not found: ${key}`);
    return { key, value };
  },
  async set(key, value) {
    localStorage.setItem(PREFIX + key, value);
    return { key, value };
  },
  async delete(key) {
    localStorage.removeItem(PREFIX + key);
    return { key, deleted: true };
  },
};
