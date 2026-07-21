const QUEUE_KEY = 'control-gastos-milena-sync-queue-v2l';
const WORKING_SNAPSHOT_KEY = 'control-gastos-milena-working-snapshot-v2l';
const ID_MAP_KEY = 'control-gastos-milena-id-map-v2l';

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function canUseLocalStorage() {
  try {
    const testKey = '__cg_storage_test__';
    localStorage.setItem(testKey, '1');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const storageAvailable = typeof window !== 'undefined' && canUseLocalStorage();

function read(key, fallback) {
  if (!storageAvailable) return fallback;
  return safeParse(localStorage.getItem(key), fallback);
}

function write(key, value) {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Si el navegador limita localStorage, la app sigue funcionando en memoria.
  }
}

export function createTempId(prefix = 'TMP') {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-LOCAL-${stamp}-${random}`;
}

export function createOperation(action, entity, payload = {}) {
  return {
    opId: createTempId('OP'),
    action,
    entity,
    id: payload.id || '',
    data: payload.data || null,
    lastKnownUpdatedAt: payload.lastKnownUpdatedAt || '',
    status: 'pending',
    attempts: 0,
    createdAt: new Date().toISOString(),
    lastError: ''
  };
}

export function getSyncQueue() {
  const queue = read(QUEUE_KEY, []);
  if (!Array.isArray(queue)) return [];
  return queue.map((item) => ({
    ...item,
    status: item.status || 'pending',
    attempts: Number(item.attempts || 0)
  }));
}

export function saveSyncQueue(queue) {
  write(QUEUE_KEY, Array.isArray(queue) ? queue : []);
}

export function getWorkingSnapshot() {
  return read(WORKING_SNAPSHOT_KEY, null);
}

export function saveWorkingSnapshot(data) {
  write(WORKING_SNAPSHOT_KEY, {
    savedAt: new Date().toISOString(),
    data
  });
}

export function getIdMap() {
  const map = read(ID_MAP_KEY, {});
  return map && typeof map === 'object' && !Array.isArray(map) ? map : {};
}

export function saveIdMap(map) {
  write(ID_MAP_KEY, map && typeof map === 'object' ? map : {});
}

export function resolveSyncedId(id, idMap = getIdMap()) {
  return idMap[id] || id;
}

export function isLocalId(id) {
  return String(id || '').includes('-LOCAL-');
}

export function hasPendingWork(queue = getSyncQueue()) {
  return queue.some((item) => item.status !== 'done');
}
