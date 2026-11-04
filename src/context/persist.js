// ─────────────────────────────────────────────────────────────────────────────
// Persistence adapter for the prototype.
//
// Everything the Context workflows change (semantic models, glossary terms,
// relationships, links, versions, profiles, history, DQ results) is written
// through ONE adapter. Swapping localStorage for the real backend means
// replacing this file, not the screens: load() returns the saved document or
// null, save() writes it, clear() forgets it. Failures are reported, never
// thrown into the UI, so a full or blocked storage area degrades to an
// in-memory session with a visible warning instead of a blank screen.
// ─────────────────────────────────────────────────────────────────────────────

export const PERSIST_SCHEMA = 1;

export function createStorageAdapter({ storage, key, onError } = {}) {
  const mem = { value: null };
  const report = (op, e) => { if (onError) onError({ op, message: String((e && e.message) || e) }); };
  const store = storage || null;
  return {
    kind: store ? "localStorage" : "memory",
    key,
    load() {
      try {
        const raw = store ? store.getItem(key) : mem.value;
        if (!raw) return null;
        const doc = JSON.parse(raw);
        if (!doc || doc.schema !== PERSIST_SCHEMA) return null;
        return doc;
      } catch (e) { report("load", e); return null; }
    },
    save(doc) {
      try {
        const raw = JSON.stringify({ ...doc, schema: PERSIST_SCHEMA, savedAt: new Date().toISOString() });
        if (store) store.setItem(key, raw); else mem.value = raw;
        return true;
      } catch (e) { report("save", e); return false; }
    },
    clear() {
      try { if (store) store.removeItem(key); else mem.value = null; return true; }
      catch (e) { report("clear", e); return false; }
    },
  };
}

// Records are matched on id. A seeded record the user deleted is remembered as a
// tombstone so a reload does not resurrect it; a seeded record that is missing
// from an older save (because the code gained a seed since) is added back.
export function mergeSaved(seed, saved, tombstones) {
  if (!Array.isArray(saved)) return seed.map(x => ({ ...x }));
  const dead = new Set(tombstones || []);
  const have = new Set(saved.map(x => x && x.id));
  return [...saved, ...seed.filter(s => !have.has(s.id) && !dead.has(s.id)).map(s => ({ ...s }))];
}

export function tombstonesOf(seed, current) {
  const have = new Set((current || []).map(x => x && x.id));
  return seed.filter(s => !have.has(s.id)).map(s => s.id);
}

// Reset Demo: restore every SEEDED record to its seeded value and bring back the
// seeded records that were deleted. Records the user created are left exactly as
// they are — the reset never touches data it did not seed.
export function resetSeeded(seed, current) {
  const seedIds = new Set(seed.map(s => s.id));
  const userMade = (current || []).filter(x => x && !seedIds.has(x.id));
  return [...seed.map(s => JSON.parse(JSON.stringify(s))), ...userMade];
}
