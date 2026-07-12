import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildConnectionGuardFromDiagnostic,
  getCachedRemoteSnapshot,
  getLastGoodDiagnostic,
  sheetsRequest,
  runConnectionDiagnostic,
  FRONTEND_VERSION,
  EXPECTED_BACKEND_VERSION
} from './api/sheetsApi.js';
import {
  createOperation,
  createTempId,
  getIdMap,
  getSyncQueue,
  getWorkingSnapshot,
  saveIdMap,
  saveSyncQueue,
  saveWorkingSnapshot,
  resolveSyncedId
} from './api/syncQueue.js';
import {
  currentMonthKey,
  getMonthBounds,
  getMonthKey,
  isDateInRange,
  money,
  normalizeText,
  parseAmount,
  sumBy,
  todayISO,
  toDateKey
} from './utils/format.js';

const emptyMile = {
  fecha: todayISO(),
  proveedor: '',
  concepto: '',
  tipoMovimiento: 'Egreso',
  monto: '',
  categoria: '',
  subcategoria: ''
};

const emptyRafa = {
  fecha: todayISO(),
  concepto: '',
  monto: '',
  categoria: ''
};

const APP_VERSION = 'Fase 4D · Hojas de movimientos dinámicas';
const SYNC_DELAY_MS = 2500;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mediaQuery = window.matchMedia(query);
    const updateMatches = (event) => setMatches(event.matches);
    setMatches(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatches);
      return () => mediaQuery.removeEventListener('change', updateMatches);
    }

    mediaQuery.addListener(updateMatches);
    return () => mediaQuery.removeListener(updateMatches);
  }, [query]);

  return matches;
}

function reloadApp() {
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

const FIXED_NAV_START = [{ id: 'dashboard', label: 'Dashboard' }];
const FIXED_NAV_END = [
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'config', label: 'Config' }
];

const DEFAULT_ACCOUNT_FIELDS = ['fecha', 'proveedor', 'concepto', 'tipoMovimiento', 'monto', 'categoria', 'subcategoria'];
const ACCOUNT_FIELD_OPTIONS = [
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'tipoMovimiento', label: 'Ingreso y egreso' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'subcategoria', label: 'Subcategoría' }
];

function normalizeAccount(account = {}) {
  return {
    id: String(account.id || '').trim(),
    name: account.id === 'mile' ? 'Mile' : String(account.name || '').trim(),
    sheetName: String(account.sheetName || '').trim(),
    type: account.type || 'dynamic',
    primary: Boolean(account.primary),
    visible: account.visible !== false,
    order: Number(account.order || 999),
    fields: Array.isArray(account.fields) && account.fields.length ? account.fields : DEFAULT_ACCOUNT_FIELDS,
    active: account.active !== false
  };
}

function accountHasField(account, field) {
  return (account?.fields || DEFAULT_ACCOUNT_FIELDS).includes(field);
}

function accountEntity(accountId) {
  if (accountId === 'mile' || accountId === 'rafa') return accountId;
  return `movement:${accountId}`;
}


function getIngreso(row) {
  if (typeof row?._ingreso === 'number') return row._ingreso;
  return parseAmount(row?.ingreso);
}

function getEgreso(row) {
  if (typeof row?._egreso === 'number') return row._egreso;
  return parseAmount(row?.egreso);
}

function getMovementType(row) {
  if (getIngreso(row) > 0 && getEgreso(row) <= 0) return 'Ingreso';
  if (getEgreso(row) > 0 && getIngreso(row) <= 0) return 'Egreso';
  return row.tipoMovimiento || 'Egreso';
}

function getMovementAmount(row) {
  if (getIngreso(row) > 0) return getIngreso(row);
  if (getEgreso(row) > 0) return getEgreso(row);
  return parseAmount(row.monto);
}

function toOfficialPayload(data) {
  const type = normalizeText(data.tipoMovimiento);
  const amount = parseAmount(data.monto);
  return {
    fecha: data.fecha,
    proveedor: data.proveedor,
    concepto: data.concepto,
    ingreso: type === 'ingreso' ? amount : 0,
    egreso: type === 'egreso' ? amount : 0,
    tipoMovimiento: data.tipoMovimiento,
    monto: amount,
    categoria: data.categoria || '',
    subcategoria: data.subcategoria || ''
  };
}

function requireFields(data, fields) {
  const missing = fields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length > 0) {
    return `Faltan campos obligatorios: ${missing.join(', ')}.`;
  }
  if (parseAmount(data.monto) <= 0) return 'El monto debe ser mayor que cero.';
  return '';
}

function Card({ title, value, detail }) {
  return (
    <article className="card">
      <span>{title}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function StatusChip({ type = 'info', children, title = '' }) {
  return (
    <span className={`status-chip-small ${type}`} title={title}>
      <span aria-hidden="true" className="status-dot" />
      {children}
    </span>
  );
}

function StatusBar({ demoMode, loading, error, notice, cachedAt, hasData, onRefresh, pendingSyncCount, failedSyncCount, syncing, onSyncNow, onDiagnostic, diagnosticLoading, connectionGuard }) {
  let connectionType = 'success';
  let connectionText = 'Conectado';
  let connectionTitle = 'Conectado correctamente a Google Sheets.';

  if (loading && hasData && cachedAt) {
    connectionType = 'info';
    connectionText = 'Actualizando';
    connectionTitle = 'Mostrando la última copia guardada mientras se actualiza Google Sheets.';
  } else if (loading) {
    connectionType = 'info';
    connectionText = 'Verificando';
    connectionTitle = 'Verificando conexión con Google Sheets.';
  } else if (error && cachedAt) {
    connectionType = 'warning';
    connectionText = 'Copia local';
    connectionTitle = 'No se pudo actualizar desde Google Sheets. Se muestra la última información guardada en este dispositivo.';
  } else if (error) {
    connectionType = 'danger';
    connectionText = 'Sin conexión';
    connectionTitle = error;
  } else if (demoMode) {
    connectionType = 'warning';
    connectionText = 'Modo local';
    connectionTitle = 'Modo demo/local activo. Configura la URL de Apps Script y el token para trabajar con Google Sheets.';
  }

  let syncType = 'warning';
  let syncText = '';
  let syncTitle = '';
  if (pendingSyncCount > 0) {
    if (failedSyncCount > 0) {
      syncType = 'danger';
      syncText = `${failedSyncCount} con error`;
      syncTitle = `${failedSyncCount} cambio(s) no se pudieron sincronizar. Puedes tocar “Sincronizar ahora”.`;
    } else if (syncing) {
      syncType = 'info';
      syncText = `${pendingSyncCount} sincronizando`;
      syncTitle = `Sincronizando ${pendingSyncCount} cambio(s) pendiente(s) con Google Sheets.`;
    } else {
      syncText = `${pendingSyncCount} pendiente`;
      syncTitle = `${pendingSyncCount} cambio(s) guardado(s) en este dispositivo y pendiente(s) por subir a Google Sheets.`;
    }
  }

  return (
    <div className="status-wrap status-wrap-compact">
      <div className="status-line" aria-live="polite">
        <StatusChip type={connectionType} title={connectionTitle}>{connectionText}</StatusChip>
        {notice && !error ? <StatusChip type="success" title={notice}>{notice}</StatusChip> : null}
        {pendingSyncCount > 0 ? <StatusChip type={syncType} title={syncTitle}>{syncText}</StatusChip> : null}
        {connectionGuard?.checked && connectionGuard.ok ? (
          <StatusChip type="success" title={`Backend ${connectionGuard.backendVersion}. Google Sheet: ${connectionGuard.spreadsheetName || 'validado'}`}>Blindaje OK</StatusChip>
        ) : null}
        {connectionGuard?.blocked ? (
          <StatusChip type="danger" title={connectionGuard.message}>Revisar conexión</StatusChip>
        ) : null}
      </div>
      {error && !hasData ? (
        <div className="connection-help">
          <strong>No se pudieron cargar los datos en este dispositivo.</strong>
          <span>La app ahora intenta conectarse primero por un puente interno de Vercel y, si no está disponible, usa Apps Script directo.</span>
          <span>Presiona actualizar o recarga con el ícono para volver a intentar.</span>
        </div>
      ) : null}
      <div className="status-actions">
        <button className="secondary" type="button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Actualizando...' : 'Actualizar datos'}
        </button>
        <button className="secondary diagnostic-button" type="button" onClick={onDiagnostic} disabled={diagnosticLoading}>
          {diagnosticLoading ? 'Diagnosticando...' : 'Diagnóstico'}
        </button>
        {pendingSyncCount > 0 ? (
          <button className="secondary sync-now-button" type="button" onClick={onSyncNow} disabled={syncing || connectionGuard?.blocked}>
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        ) : null}
        <button className="icon-button" type="button" onClick={reloadApp} title="Recargar app" aria-label="Recargar app">
          ↻
        </button>
      </div>
    </div>
  );
}



function readDiagnosticPath(obj, path, fallback = '') {
  return path.split('.').reduce((acc, key) => acc && acc[key] !== undefined ? acc[key] : undefined, obj) ?? fallback;
}

function DiagnosticRow({ label, value, danger = false }) {
  return (
    <div className="diagnostic-row">
      <span>{label}</span>
      <strong className={danger ? 'danger-text' : ''}>{String(value || '—')}</strong>
    </div>
  );
}

function DiagnosticPanel({ open, loading, result, onClose }) {
  if (!open) return null;

  const backendVersion = result?.backendVersion || readDiagnosticPath(result, 'diagnostic.backendVersion', 'No reportada');
  const versionMismatch = backendVersion !== 'No reportada' && backendVersion !== EXPECTED_BACKEND_VERSION;
  const spreadsheetOk = Boolean(result?.spreadsheet?.ok);
  const configuredSpreadsheetId = result?.configuredSpreadsheetIdFull || result?.configuredSpreadsheetId || '';
  const sheetNames = result?.spreadsheet?.sheets || [];
  const vercelUrl = readDiagnosticPath(result, 'diagnostic.vercel.appsScriptUrlPreview', readDiagnosticPath(result, 'diagnostic.frontend.appsScriptUrlPreview', ''));
  const proxyError = readDiagnosticPath(result, 'diagnostic.proxyError', '');
  const directError = readDiagnosticPath(result, 'diagnostic.directError', '');

  return (
    <div className="diagnostic-overlay" role="dialog" aria-modal="true" aria-label="Diagnóstico de conexión">
      <div className="diagnostic-card">
        <div className="diagnostic-head">
          <div>
            <p className="eyebrow">Fase 4D</p>
            <h2>Diagnóstico de conexión</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Cerrar diagnóstico">×</button>
        </div>

        {loading ? <div className="panel loading">Revisando Vercel, Apps Script y Google Sheets...</div> : null}

        {!loading && result ? (
          <div className="diagnostic-body">
            <div className={`diagnostic-status ${result.ok ? 'success' : 'danger'}`}>
              <strong>{result.ok ? 'Conexión revisada' : 'Se encontró un problema'}</strong>
              <span>{result.message || (result.ok ? 'Apps Script respondió al diagnóstico.' : 'No se pudo completar el diagnóstico.')}</span>
            </div>

            {versionMismatch ? (
              <div className="diagnostic-warning">
                <strong>Posible versión vieja detectada.</strong>
                <span>La app espera el backend {EXPECTED_BACKEND_VERSION}, pero Apps Script respondió {backendVersion}. Crea una “Nueva versión” en Apps Script y copia esa URL en Vercel.</span>
              </div>
            ) : null}

            <div className="diagnostic-grid">
              <DiagnosticRow label="Frontend esperado" value={FRONTEND_VERSION} />
              <DiagnosticRow label="Backend respondido" value={backendVersion} danger={versionMismatch} />
              <DiagnosticRow label="Último diagnóstico bueno" value={formatDiagnosticDate(readDiagnosticPath(result, 'diagnostic.lastGood.savedAt', '')) || 'Sin registro local'} />
              <DiagnosticRow label="URL Apps Script en Vercel" value={vercelUrl} />
              <DiagnosticRow label="ID de Google Sheet configurado" value={configuredSpreadsheetId || readDiagnosticPath(result, 'configuredSpreadsheetId', '')} />
              <DiagnosticRow label="Google Sheet conectado" value={spreadsheetOk ? 'Sí' : 'No'} danger={!spreadsheetOk} />
              <DiagnosticRow label="Nombre del archivo" value={readDiagnosticPath(result, 'spreadsheet.name', '')} />
              <DiagnosticRow label="Mile (Tabla Oficial)" value={readDiagnosticPath(result, 'spreadsheet.tablaOficialSheet', false) ? 'Existe' : 'No encontrada'} danger={!readDiagnosticPath(result, 'spreadsheet.tablaOficialSheet', false)} />
              <DiagnosticRow label="Recordatorios" value={readDiagnosticPath(result, 'spreadsheet.recordatoriosSheet', false) ? 'Existe' : 'Se creará al sincronizar'} />
            </div>

            {sheetNames.length ? (
              <div className="diagnostic-list">
                <strong>Hojas encontradas</strong>
                <span>{sheetNames.join(' · ')}</span>
              </div>
            ) : null}

            {proxyError || directError ? (
              <div className="diagnostic-list danger-text">
                {proxyError ? <span><b>Puente Vercel:</b> {proxyError}</span> : null}
                {directError ? <span><b>Apps Script directo:</b> {directError}</span> : null}
              </div>
            ) : null}

            <div className="diagnostic-help">
              <strong>Qué hacer si todavía aparece el ID viejo</strong>
              <span>1. En Apps Script: Implementar → Administrar implementaciones → lápiz → Versión nueva → Implementar.</span>
              <span>2. Copia la URL de esa app web y pégala en Vercel como VITE_APPS_SCRIPT_URL.</span>
              <span>3. En Vercel haz Redeploy. Luego vuelve a abrir este diagnóstico.</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}


function formatDiagnosticDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return value;
  }
}

function ConnectionGuardNotice({ guard, onDiagnostic }) {
  if (!guard?.blocked) return null;
  const lastGood = guard.lastGood;
  const lastGoodText = lastGood?.savedAt
    ? `Última conexión correcta: ${formatDiagnosticDate(lastGood.savedAt)}.`
    : 'Todavía no hay una conexión correcta guardada en este dispositivo.';

  return (
    <div className="connection-guard-notice" role="alert">
      <div>
        <strong>Blindaje de conexión activo</strong>
        <span>{guard.message}</span>
        <small>{lastGoodText}</small>
      </div>
      <button className="secondary" type="button" onClick={onDiagnostic}>Abrir diagnóstico</button>
    </div>
  );
}

const DASHBOARD_TABLE_COLUMNS = [
  { key: 'fecha', label: 'Fecha' },
  { key: 'proveedor', label: 'Proveedor' },
  { key: 'concepto', label: 'Concepto' },
  { key: 'ingreso', label: 'Ingreso' },
  { key: 'egreso', label: 'Egreso' },
  { key: 'categoria', label: 'Categoría' },
  { key: 'subcategoria', label: 'Subcategoría' },
  { key: 'saldoAcumulado', label: 'Saldo acumulado' }
];

const DEFAULT_DASHBOARD_COLUMNS = DASHBOARD_TABLE_COLUMNS.map((column) => column.key);

function getRowDateKey(row) {
  return row?._fechaKey || toDateKey(row?.fecha);
}

function compareOfficialRowsAsc(a, b) {
  const dateCompare = getRowDateKey(a).localeCompare(getRowDateKey(b));
  if (dateCompare !== 0) return dateCompare;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function formatShortDate(fecha) {
  const key = toDateKey(fecha);
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    const [year, month, day] = key.split('-');
    return `${day}/${month}/${year.slice(-2)}`;
  }
  return fecha || '-';
}

function getDashboardCellClass(columnKey) {
  if (columnKey === 'fecha') return 'date-cell';
  if (columnKey === 'ingreso') return 'income-cell amount-cell';
  if (columnKey === 'egreso') return 'expense-cell amount-cell';
  if (columnKey === 'saldoAcumulado') return 'balance-cell amount-cell';
  return '';
}

function getSyncLabel(row) {
  if (row?.syncStatus === 'failed') return 'Error';
  if (row?.syncStatus === 'syncing') return 'Sincronizando';
  if (row?.syncStatus === 'pending') return 'Pendiente';
  return 'OK';
}

function SyncPill({ row }) {
  const label = getSyncLabel(row);
  return <span className={`sync-pill ${String(row?.syncStatus || 'synced')}`}>{label}</span>;
}

function markPending(row, status = 'pending') {
  return {
    ...row,
    syncStatus: status,
    syncError: status === 'failed' ? row.syncError : ''
  };
}


const REMINDERS_STORAGE_KEY = 'control-gastos-milena-reminders-v1';

function normalizeReminderData(item = {}) {
  const rawStatus = normalizeText(item.status || item.estado || 'pending');
  return {
    ...item,
    id: item.id || item.idRecordatorio || `REM-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text: item.text || item.titulo || '',
    detail: item.detail || item.detalle || '',
    dueDate: item.dueDate || item.fecha || '',
    dueTime: item.dueTime || item.hora || '',
    recurrence: item.recurrence || item.recurrencia || 'none',
    recurrenceLabel: item.recurrenceLabel || item.etiquetaRecurrencia || '',
    status: rawStatus === 'done' || rawStatus === 'completado' ? 'done' : rawStatus === 'deleted' || rawStatus === 'eliminado' ? 'deleted' : 'pending',
    createdAt: item.createdAt || item.creadoEn || item.creado_en || new Date().toISOString(),
    updatedAt: item.updatedAt || item.actualizadoEn || item.actualizado_en || '',
    completedAt: item.completedAt || item.completadoEn || item.completado_en || '',
    lastCompletedAt: item.lastCompletedAt || item.ultimoCompletadoEn || '',
    syncStatus: item.syncStatus || 'synced',
    syncError: item.syncError || ''
  };
}

function readStoredReminders() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REMINDERS_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeReminderData)
      .filter((item) => item.text.trim() && item.status !== 'deleted');
  } catch {
    return [];
  }
}

function saveStoredReminders(reminders) {
  window.localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
}

function addDaysToISO(baseISO, days) {
  const [year, month, day] = baseISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonthsToISO(baseISO, months) {
  const [year, month, day] = baseISO.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const originalDay = date.getDate();
  date.setMonth(date.getMonth() + months);
  if (date.getDate() !== originalDay) date.setDate(0);
  return date.toISOString().slice(0, 10);
}

function addYearsToISO(baseISO, years) {
  const [year, month, day] = baseISO.split('-').map(Number);
  const date = new Date(year + years, month - 1, day);
  return date.toISOString().slice(0, 10);
}

function lastDayOfMonthISO(baseISO) {
  const [year, month] = baseISO.split('-').map(Number);
  const date = new Date(year, month, 0);
  return date.toISOString().slice(0, 10);
}

function buildISODate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return '';
  if (m < 1 || m > 12 || d < 1 || d > 31) return '';
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return '';
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const SPANISH_MONTHS = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12
};

const WEEKDAYS = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6
};

const NUMBER_WORDS = {
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30
};

function parseNumberWord(value) {
  const normalized = normalizeText(value);
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return NUMBER_WORDS[normalized] || 0;
}

function normalizeYear(yearText, fallbackYear) {
  if (!yearText) return fallbackYear;
  const year = Number(yearText);
  if (!Number.isFinite(year)) return fallbackYear;
  if (year < 100) return 2000 + year;
  return year;
}

function nextWeekdayISO(baseISO, weekday, forceNextWeek = false) {
  const [year, month, day] = baseISO.split('-').map(Number);
  const base = new Date(year, month - 1, day);
  let diff = weekday - base.getDay();
  if (diff < 0) diff += 7;
  if (forceNextWeek && diff === 0) diff = 7;
  if (!forceNextWeek && diff === 0) diff = 7;
  base.setDate(base.getDate() + diff);
  return base.toISOString().slice(0, 10);
}

function parseReminderTime(original) {
  const lower = normalizeText(original);
  const explicit = lower.match(/\b(?:a\s+las?|sobre\s+las?)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\b/);
  if (explicit) {
    let hour = Number(explicit[1]);
    const minute = Number(explicit[2] || '0');
    const meridian = String(explicit[3] || '').replace(/[\s.]/g, '');
    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return {
        dueTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
        label: explicit[0],
        phrase: explicit[0]
      };
    }
  }

  const dayParts = [
    { pattern: /\b(en|por)\s+la\s+manana\b|\b(en|por)\s+la\s+mañana\b|\btemprano\b/, dueTime: '09:00', label: 'en la mañana' },
    { pattern: /\b(en|por)\s+la\s+tarde\b/, dueTime: '15:00', label: 'en la tarde' },
    { pattern: /\b(en|por)\s+la\s+noche\b/, dueTime: '19:00', label: 'en la noche' },
    { pattern: /\bmedio\s*dia\b|\bmediodia\b|\bmedio\s*día\b|\bmediodía\b/, dueTime: '12:00', label: 'al mediodía' }
  ];

  for (const part of dayParts) {
    const match = lower.match(part.pattern);
    if (match) return { dueTime: part.dueTime, label: part.label, phrase: match[0] };
  }

  return { dueTime: '', label: '', phrase: '' };
}

function parseReminderRecurrence(original) {
  const lower = normalizeText(original);
  const options = [
    { pattern: /\b(cada\s+dia|cada\s+día|diario|diaria|todos\s+los\s+dias|todos\s+los\s+días)\b/, recurrence: 'daily', label: 'Cada día' },
    { pattern: /\b(cada\s+semana|semanal|todas\s+las\s+semanas)\b/, recurrence: 'weekly', label: 'Cada semana' },
    { pattern: /\b(cada\s+mes|mensual|todos\s+los\s+meses)\b/, recurrence: 'monthly', label: 'Cada mes' },
    { pattern: /\b(cada\s+ano|cada\s+año|anual|todos\s+los\s+anos|todos\s+los\s+años)\b/, recurrence: 'yearly', label: 'Cada año' }
  ];

  for (const option of options) {
    const match = lower.match(option.pattern);
    if (match) return { recurrence: option.recurrence, recurrenceLabel: option.label, phrase: match[0] };
  }
  return { recurrence: 'none', recurrenceLabel: '', phrase: '' };
}

function parseReminderDate(original) {
  const today = todayISO();
  const currentYear = Number(today.slice(0, 4));
  const lower = normalizeText(original);

  const isoMatch = original.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return { dueDate: buildISODate(isoMatch[1], isoMatch[2], isoMatch[3]), phrase: isoMatch[0] };
  }

  const colombianMatch = original.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (colombianMatch) {
    const year = normalizeYear(colombianMatch[3], currentYear);
    return { dueDate: buildISODate(year, colombianMatch[2], colombianMatch[1]), phrase: colombianMatch[0] };
  }

  const monthNames = Object.keys(SPANISH_MONTHS).join('|');
  const monthNameMatch = lower.match(new RegExp(`\\b(?:el\\s+)?(\\d{1,2})\\s+de\\s+(${monthNames})(?:\\s+de\\s+(\\d{2,4}))?\\b`));
  if (monthNameMatch) {
    const year = normalizeYear(monthNameMatch[3], currentYear);
    return {
      dueDate: buildISODate(year, SPANISH_MONTHS[monthNameMatch[2]], monthNameMatch[1]),
      phrase: monthNameMatch[0]
    };
  }

  const relativeMatch = lower.match(/\ben\s+(\d+|un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta)\s+(dia|dias|día|días|semana|semanas|mes|meses|ano|anos|año|años)\b/);
  if (relativeMatch) {
    const amount = parseNumberWord(relativeMatch[1]);
    const unit = normalizeText(relativeMatch[2]);
    if (amount > 0 && (unit === 'dia' || unit === 'dias')) return { dueDate: addDaysToISO(today, amount), phrase: relativeMatch[0] };
    if (amount > 0 && unit.startsWith('semana')) return { dueDate: addDaysToISO(today, amount * 7), phrase: relativeMatch[0] };
    if (amount > 0 && unit.startsWith('mes')) return { dueDate: addMonthsToISO(today, amount), phrase: relativeMatch[0] };
    if (amount > 0 && (unit === 'ano' || unit === 'anos')) return { dueDate: addYearsToISO(today, amount), phrase: relativeMatch[0] };
  }

  if (/\bpasado\s+manana\b|\bpasado\s+mañana\b/.test(lower)) return { dueDate: addDaysToISO(today, 2), phrase: 'pasado mañana' };
  if (/\bmanana\b|\bmañana\b/.test(lower)) return { dueDate: addDaysToISO(today, 1), phrase: 'mañana' };
  if (/\bhoy\b/.test(lower)) return { dueDate: today, phrase: 'hoy' };
  if (/\bfin\s+de\s+mes\b|\bfinal\s+de\s+mes\b|\bfinales\s+de\s+mes\b/.test(lower)) return { dueDate: lastDayOfMonthISO(today), phrase: 'fin de mes' };
  if (/\bquincena\b|\bmitad\s+de\s+mes\b/.test(lower)) return { dueDate: buildISODate(currentYear, Number(today.slice(5, 7)), 15), phrase: 'quincena' };
  if (/\bla\s+proxima\s+semana\b|\bla\s+próxima\s+semana\b|\bla\s+otra\s+semana\b/.test(lower)) return { dueDate: addDaysToISO(today, 7), phrase: 'próxima semana' };

  if (/\bfin\s+de\s+semana\b/.test(lower)) {
    return { dueDate: nextWeekdayISO(today, 6, true), phrase: 'fin de semana' };
  }

  const weekdayNames = Object.keys(WEEKDAYS).join('|');
  const weekdayMatch = lower.match(new RegExp(`\\b(?:el\\s+)?(?:(proximo|próximo|prox|siguiente)\\s+)?(${weekdayNames})\\b`));
  if (weekdayMatch) {
    return {
      dueDate: nextWeekdayISO(today, WEEKDAYS[weekdayMatch[2]], Boolean(weekdayMatch[1])),
      phrase: weekdayMatch[0]
    };
  }

  return { dueDate: '', phrase: '' };
}

function cleanReminderText(original) {
  const monthNames = Object.keys(SPANISH_MONTHS).join('|');
  const weekdayNames = 'domingo|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado';
  const numberWords = 'un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte|treinta';

  return String(original || '')
    .replace(/^(crear\s+)?(recordatorio|recordar|recuerdame|recuérdame|anotar|nota|agenda|agendar)\s*(que|de|para)?\s*/i, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b/g, ' ')
    .replace(new RegExp(`\\b(?:el\\s+)?\\d{1,2}\\s+de\\s+(${monthNames})(?:\\s+de\\s+\\d{2,4})?\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\ben\\s+(\\d+|${numberWords})\\s+(dia|dias|día|días|semana|semanas|mes|meses|ano|anos|año|años)\\b`, 'gi'), ' ')
    .replace(/\bpasado\s+ma[nñ]ana\b|\bma[nñ]ana\b|\bhoy\b/gi, ' ')
    .replace(/\bfin\s+de\s+mes\b|\bfinal\s+de\s+mes\b|\bfinales\s+de\s+mes\b|\bquincena\b|\bmitad\s+de\s+mes\b/gi, ' ')
    .replace(/\bla\s+pr[oó]xima\s+semana\b|\bla\s+otra\s+semana\b|\bfin\s+de\s+semana\b/gi, ' ')
    .replace(new RegExp(`\\b(?:el\\s+)?(?:(proximo|próximo|prox|siguiente)\\s+)?(${weekdayNames})\\b`, 'gi'), ' ')
    .replace(/\b(?:a\s+las?|sobre\s+las?)\s+\d{1,2}(?::\d{2})?\s*(a\.?\s*m\.?|p\.?\s*m\.?|am|pm)?\b/gi, ' ')
    .replace(/\b(en|por)\s+la\s+ma[nñ]ana\b|\b(en|por)\s+la\s+tarde\b|\b(en|por)\s+la\s+noche\b|\btemprano\b|\bmedio\s*d[ií]a\b|\bmediod[ií]a\b/gi, ' ')
    .replace(/\b(cada\s+d[ií]a|diario|diaria|todos\s+los\s+d[ií]as|cada\s+semana|semanal|todas\s+las\s+semanas|cada\s+mes|mensual|todos\s+los\s+meses|cada\s+a[nñ]o|anual|todos\s+los\s+a[nñ]os)\b/gi, ' ')
    .replace(/\b(el|la|los|las|para|por|en|a)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .trim();
}

function parseReminderCommand(rawText) {
  const original = String(rawText || '').trim();
  const dateInfo = parseReminderDate(original);
  const timeInfo = parseReminderTime(original);
  const recurrenceInfo = parseReminderRecurrence(original);
  const cleaned = cleanReminderText(original);

  return {
    text: cleaned || original,
    dueDate: dateInfo.dueDate,
    dueTime: timeInfo.dueTime,
    recurrence: recurrenceInfo.recurrence,
    recurrenceLabel: recurrenceInfo.recurrenceLabel
  };
}

function formatReminderTime(dueTime) {
  if (!dueTime) return '';
  const [hourText, minuteText] = dueTime.split(':');
  let hour = Number(hourText);
  const minute = minuteText || '00';
  const suffix = hour >= 12 ? 'p. m.' : 'a. m.';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${suffix}`;
}

function formatReminderDate(dueDate, dueTime = '', recurrenceLabel = '') {
  const dateText = (() => {
    if (!dueDate) return 'Sin fecha';
    if (dueDate === todayISO()) return 'Hoy';
    if (dueDate === addDaysToISO(todayISO(), 1)) return 'Mañana';
    return formatShortDate(dueDate);
  })();
  const timeText = formatReminderTime(dueTime);
  const parts = [dateText];
  if (timeText) parts.push(timeText);
  if (recurrenceLabel) parts.push(recurrenceLabel);
  return parts.join(' · ');
}

function getNextRecurrenceDate(reminder) {
  const base = reminder?.dueDate || todayISO();
  if (reminder?.recurrence === 'daily') return addDaysToISO(base, 1);
  if (reminder?.recurrence === 'weekly') return addDaysToISO(base, 7);
  if (reminder?.recurrence === 'monthly') return addMonthsToISO(base, 1);
  if (reminder?.recurrence === 'yearly') return addYearsToISO(base, 1);
  return '';
}

function ReminderAssistant({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hola. Escribe el recordatorio como lo dirías normalmente. Por ejemplo: “Recordar pagar la luz mañana en la tarde”.'
    }
  ]);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  function sendMessage(event) {
    event?.preventDefault();
    const raw = input.trim();
    if (!raw) return;

    const parsed = parseReminderCommand(raw);
    const newReminder = onCreate(parsed);

    setMessages((current) => [
      ...current,
      { id: `user-${Date.now()}`, role: 'user', text: raw },
      {
        id: `bot-${Date.now()}`,
        role: 'bot',
        text: `Listo. Guardé “${newReminder.text}” para ${formatReminderDate(newReminder.dueDate, newReminder.dueTime, newReminder.recurrenceLabel)}. Puedes editarlo, completarlo o borrarlo desde Pendientes.`
      }
    ]);
    setInput('');
  }

  return (
    <div className={`assistant-widget ${open ? 'open' : ''}`}>
      {open ? (
        <section className="assistant-panel assistant-panel-simple" aria-label="Asistente de recordatorios">
          <header className="assistant-header">
            <div>
              <span>Asistente</span>
              <strong>Crear recordatorio</strong>
            </div>
            <button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label="Cerrar asistente">×</button>
          </header>

          <div className="assistant-messages" ref={listRef}>
            {messages.map((message) => (
              <p key={message.id} className={`assistant-message ${message.role}`}>{message.text}</p>
            ))}
          </div>

          <form className="assistant-form" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe un recordatorio..."
              aria-label="Escribir recordatorio"
            />
            <button type="submit">Guardar</button>
          </form>
        </section>
      ) : null}

      <button type="button" className="assistant-fab" onClick={() => setOpen((current) => !current)} aria-label="Abrir asistente de recordatorios">
        <span>💬</span>
      </button>
    </div>
  );
}

function Dashboard({ mile, rafa, month, setMonth }) {
  const initialRange = getMonthBounds(month);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(initialRange.from);
  const [rangeTo, setRangeTo] = useState(initialRange.to);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_DASHBOARD_COLUMNS);

  const rowsWithBalance = useMemo(() => {
    let runningBalance = 0;
    return [...mile]
      .sort(compareOfficialRowsAsc)
      .map((row) => {
        runningBalance += getIngreso(row) - getEgreso(row);
        return {
          ...row,
          saldoAcumulado: runningBalance
        };
      });
  }, [mile]);

  const monthRows = rowsWithBalance.filter((row) => (row._monthKey || getMonthKey(row.fecha)) === month);
  const totalIngresos = sumBy(monthRows, getIngreso);
  const totalEgresos = sumBy(monthRows, getEgreso);
  const saldoMes = monthRows.length > 0 ? monthRows[monthRows.length - 1].saldoAcumulado : 0;
  const saldoAcumulado = rowsWithBalance.length > 0 ? rowsWithBalance[rowsWithBalance.length - 1].saldoAcumulado : 0;
  const rafaMes = sumBy(
    rafa.filter((row) => (row._monthKey || getMonthKey(row.fecha)) === month),
    (row) => row.monto
  );

  const rangeRows = useMemo(() => rowsWithBalance
    .filter((row) => isDateInRange(row.fecha, rangeFrom, rangeTo)),
  [rowsWithBalance, rangeFrom, rangeTo]);

  const totalRangoIngresos = sumBy(rangeRows, getIngreso);
  const totalRangoEgresos = sumBy(rangeRows, getEgreso);
  const saldoRango = totalRangoIngresos - totalRangoEgresos;

  const byCategory = Object.entries(
    monthRows.reduce((acc, row) => {
      if (getEgreso(row) <= 0) return acc;
      const key = row.categoria || 'Sin categoría';
      acc[key] = (acc[key] || 0) + getEgreso(row);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const lastRows = [...mile]
    .sort((a, b) => getRowDateKey(b).localeCompare(getRowDateKey(a)) || String(b.id).localeCompare(String(a.id)))
    .slice(0, 6);

  function useSelectedMonthAsRange() {
    const nextRange = getMonthBounds(month);
    setRangeFrom(nextRange.from);
    setRangeTo(nextRange.to);
    setRangeOpen(true);
  }

  function toggleColumn(columnKey) {
    setVisibleColumns((current) => {
      if (current.includes(columnKey)) {
        if (current.length === 1) return current;
        return current.filter((key) => key !== columnKey);
      }
      return [...current, columnKey];
    });
  }

  function renderDashboardCell(row, columnKey) {
    if (columnKey === 'fecha') return formatShortDate(row.fecha);
    if (columnKey === 'proveedor') return row.proveedor || '-';
    if (columnKey === 'concepto') return row.concepto || '-';
    if (columnKey === 'ingreso') return getIngreso(row) > 0 ? money(getIngreso(row)) : '-';
    if (columnKey === 'egreso') return getEgreso(row) > 0 ? money(getEgreso(row)) : '-';
    if (columnKey === 'categoria') return row.categoria || '-';
    if (columnKey === 'subcategoria') return row.subcategoria || '-';
    if (columnKey === 'saldoAcumulado') return money(row.saldoAcumulado);
    return '-';
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Resumen principal</p>
          <h2>Dashboard de Milena</h2>
        </div>
        <label className="month-picker">
          Mes
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </div>

      <div className="cards-grid">
        <Card title="Ingresos del mes" value={money(totalIngresos)} />
        <Card title="Egresos del mes" value={money(totalEgresos)} />
        <Card title="Saldo del mes" value={money(saldoMes)} detail="Acumulado al último movimiento del mes" />
        <Card title="Saldo acumulado" value={money(saldoAcumulado)} detail="Ingresos - egresos registrados" />
        <Card title="Gastos Rafa del mes" value={money(rafaMes)} detail="Módulo secundario" />
      </div>

      <div className="dashboard-tools">
        <div>
          <p className="eyebrow">Tabla Oficial por rango</p>
          <h3>Movimientos con saldo acumulado</h3>
          <p className="muted range-caption">
            Rango actual: {rangeFrom || 'sin fecha inicial'} a {rangeTo || 'sin fecha final'} · {rangeRows.length} registros
          </p>
        </div>
        <div className="dashboard-tool-actions">
          <button className="secondary" type="button" onClick={() => setRangeOpen((current) => !current)}>
            {rangeOpen ? 'Ocultar rango' : 'Seleccionar rango de fechas'}
          </button>
          <button className="secondary" type="button" onClick={useSelectedMonthAsRange}>
            Usar mes seleccionado
          </button>
        </div>
      </div>

      {rangeOpen ? (
        <div className="date-range-panel">
          <label>
            Desde
            <input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} />
          </label>
          <button className="secondary" type="button" onClick={() => { setRangeFrom(''); setRangeTo(''); }}>
            Ver todo
          </button>
        </div>
      ) : null}

      <div className="range-summary-grid">
        <Card title="Ingresos del rango" value={money(totalRangoIngresos)} />
        <Card title="Egresos del rango" value={money(totalRangoEgresos)} />
        <Card title="Saldo del rango" value={money(saldoRango)} />
      </div>

      <details className="column-toggle-panel">
        <summary>Mostrar columnas</summary>
        <div className="column-toggle-list">
          {DASHBOARD_TABLE_COLUMNS.map((column) => (
            <label className="checkbox-chip" key={column.key}>
              <input
                type="checkbox"
                checked={visibleColumns.includes(column.key)}
                onChange={() => toggleColumn(column.key)}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
      </details>

      <p className="table-scroll-hint">Desliza la tabla hacia los lados para ver más columnas.</p>

      <div className="table-wrap dashboard-table-wrap dashboard-responsive-table">
        <table>
          <thead>
            <tr>
              {DASHBOARD_TABLE_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rangeRows.map((row) => (
              <tr key={`dashboard-${row.id}`}>
                {DASHBOARD_TABLE_COLUMNS.filter((column) => visibleColumns.includes(column.key)).map((column) => (
                  <td
                    key={column.key}
                    className={getDashboardCellClass(column.key)}
                  >
                    {renderDashboardCell(row, column.key)}
                  </td>
                ))}
              </tr>
            ))}
            {rangeRows.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} className="empty">No hay registros en este rango.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="two-col dashboard-bottom-panels">
        <article className="subpanel">
          <h3>Gastos por categoría</h3>
          {byCategory.length === 0 ? (
            <p className="muted">No hay egresos para este mes.</p>
          ) : (
            <div className="category-list">
              {byCategory.map(([category, total]) => (
                <div className="category-row" key={category}>
                  <span>{category}</span>
                  <strong>{money(total)}</strong>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="subpanel">
          <h3>Últimos movimientos</h3>
          <div className="mini-list">
            {lastRows.map((row) => (
              <div className="mini-row" key={row.id}>
                <div>
                  <strong>{row.concepto}</strong>
                  <span>{row.fecha} · {row.categoria || 'Sin categoría'}</span>
                </div>
                <em className={getIngreso(row) > 0 ? 'income' : 'expense'}>
                  {getIngreso(row) > 0 ? '+' : '-'}{money(getMovementAmount(row))}
                </em>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function MileForm({ config, initialData, editingId, onCancel, onSubmit, saving }) {
  const [form, setForm] = useState(initialData || emptyMile);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setForm(initialData || emptyMile);
    setLocalError('');
  }, [initialData]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const error = requireFields(form, [
      'fecha',
      'proveedor',
      'concepto',
      'tipoMovimiento',
      'monto'
    ]);
    if (error) {
      setLocalError(error);
      return;
    }
    onSubmit(toOfficialPayload({ ...form, monto: parseAmount(form.monto) }));
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Fecha <span>*</span>
        <input type="date" value={form.fecha} onChange={(event) => update('fecha', event.target.value)} />
      </label>

      <label>
        Proveedor <span>*</span>
        <input value={form.proveedor} onChange={(event) => update('proveedor', event.target.value)} placeholder="Ej. Bancolombia" />
      </label>

      <label className="wide">
        Concepto <span>*</span>
        <input value={form.concepto} onChange={(event) => update('concepto', event.target.value)} placeholder="Ej. Pago crédito hipotecario" />
      </label>

      <label>
        Tipo de movimiento <span>*</span>
        <select value={form.tipoMovimiento} onChange={(event) => update('tipoMovimiento', event.target.value)}>
          <option value="">Seleccionar</option>
          {config.tiposMovimiento.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        Monto <span>*</span>
        <input type="number" min="1" value={form.monto} onChange={(event) => update('monto', event.target.value)} placeholder="0" />
      </label>

      <label>
        Categoría
        <select value={form.categoria} onChange={(event) => update('categoria', event.target.value)}>
          <option value="">Seleccionar</option>
          {config.categorias.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        Subcategoría
        <select value={form.subcategoria} onChange={(event) => update('subcategoria', event.target.value)}>
          <option value="">Seleccionar</option>
          {config.subcategorias.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      {localError ? <p className="form-error wide">{localError}</p> : null}

      <div className="actions wide">
        <button type="submit" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Actualizar movimiento' : 'Guardar movimiento'}</button>
        {editingId ? <button className="secondary" type="button" onClick={onCancel}>Cancelar edición</button> : null}
      </div>
    </form>
  );
}


function EditMovementModal({ open, eyebrow, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="edit-movement-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="edit-movement-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="edit-movement-head">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            <p className="muted">Realiza los cambios y presiona actualizar para guardarlos.</p>
          </div>
          <button className="edit-movement-close" type="button" onClick={onClose} aria-label="Cerrar ventana de edición">×</button>
        </div>
        <div className="edit-movement-body">{children}</div>
      </section>
    </div>
  );
}

function MileEditModal({ row, config, saving, onSubmit, onClose }) {
  return (
    <EditMovementModal
      open={Boolean(row)}
      eyebrow="Tabla Oficial"
      title="Editar movimiento"
      onClose={onClose}
    >
      {row ? (
        <MileForm
          config={config}
          initialData={row}
          editingId={row.id}
          saving={saving}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      ) : null}
    </EditMovementModal>
  );
}

function RafaEditModal({ row, config, saving, onSubmit, onClose }) {
  const [form, setForm] = useState(row || emptyRafa);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setForm(row || emptyRafa);
    setLocalError('');
  }, [row]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validation = requireFields(form, ['fecha', 'concepto', 'monto', 'categoria']);
    if (validation) {
      setLocalError(validation);
      return;
    }
    onSubmit({ ...form, monto: parseAmount(form.monto) });
  }

  return (
    <EditMovementModal
      open={Boolean(row)}
      eyebrow="Gastos Rafa"
      title="Editar gasto de Rafa"
      onClose={onClose}
    >
      {row ? (
        <form className="form-grid compact" onSubmit={handleSubmit}>
          <label>
            Fecha <span>*</span>
            <input type="date" value={form.fecha} onChange={(event) => update('fecha', event.target.value)} />
          </label>
          <label className="wide">
            Concepto <span>*</span>
            <input value={form.concepto} onChange={(event) => update('concepto', event.target.value)} />
          </label>
          <label>
            Monto <span>*</span>
            <input type="number" min="1" value={form.monto} onChange={(event) => update('monto', event.target.value)} />
          </label>
          <label>
            Categoría <span>*</span>
            <select value={form.categoria} onChange={(event) => update('categoria', event.target.value)}>
              <option value="">Seleccionar</option>
              {config.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {localError ? <p className="form-error wide">{localError}</p> : null}
          <div className="actions wide">
            <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Actualizar gasto Rafa'}</button>
            <button className="secondary" type="button" onClick={onClose}>Cancelar edición</button>
          </div>
        </form>
      ) : null}
    </EditMovementModal>
  );
}

function InicioModule({ rows, config, formOpen, setFormOpen, saving, onSave, onEdit, onDelete }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewMode, setViewMode] = useState(() => window.localStorage.getItem('control-gastos-inicio-view') || 'table');
  const isMobileView = useMediaQuery('(max-width: 720px)');
  const activeViewMode = isMobileView ? viewMode : 'table';

  useEffect(() => {
    window.localStorage.setItem('control-gastos-inicio-view', viewMode);
  }, [viewMode]);

  const rowsWithBalance = useMemo(() => {
    let runningBalance = 0;
    return [...rows]
      .sort(compareOfficialRowsAsc)
      .map((row) => {
        runningBalance += getIngreso(row) - getEgreso(row);
        return { ...row, saldoAcumulado: runningBalance };
      });
  }, [rows]);

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return rowsWithBalance
      .filter((row) => {
        const matchesQuery = !q || [row.proveedor, row.concepto, row.categoria, row.subcategoria, row.id]
          .some((value) => normalizeText(value).includes(q));
        const matchesType = !type || getMovementType(row) === type;
        const matchesCategory = !category || row.categoria === category;
        const matchesFrom = !from || isDateInRange(row.fecha, from, '');
        const matchesTo = !to || isDateInRange(row.fecha, '', to);
        return matchesQuery && matchesType && matchesCategory && matchesFrom && matchesTo;
      })
      .sort((a, b) => getRowDateKey(b).localeCompare(getRowDateKey(a)) || String(b.id).localeCompare(String(a.id)));
  }, [rowsWithBalance, query, type, category, from, to]);

  function openNewRecord() {
    setFormOpen(true);
  }

  return (
    <>
      <section className="panel home-header-panel">
        <div className="panel-head home-main-head">
          <div>
            <p className="eyebrow">Tabla Oficial</p>
            <h2>Inicio</h2>
            <p className="muted home-description">Registra movimientos y consulta el historial desde un solo lugar.</p>
          </div>
          <button type="button" onClick={formOpen ? () => setFormOpen(false) : openNewRecord}>
            {formOpen ? 'Cerrar formulario' : '+ Nuevo registro'}
          </button>
        </div>
      </section>

      {formOpen ? (
        <section className="panel home-form-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Nuevo registro</p>
              <h2>Nuevo movimiento</h2>
            </div>
          </div>
          <MileForm
            config={config}
            initialData={emptyMile}
            saving={saving}
            onSubmit={onSave}
            onCancel={() => setFormOpen(false)}
          />
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-head history-heading">
          <div>
            <p className="eyebrow">Historial de movimientos</p>
            <h2>Tabla principal</h2>
          </div>
          <div className="history-head-actions">
            <strong>{filtered.length} registros</strong>
            {isMobileView ? (
              <div className="view-switch" role="group" aria-label="Cambiar vista del historial">
                <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Tabla</button>
                <button type="button" className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>Tarjetas</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por concepto o proveedor" />
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Tipo: todos</option>
            {config.tiposMovimiento.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Categoría: todas</option>
            {config.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Fecha desde" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Fecha hasta" />
        </div>

        {activeViewMode === 'cards' ? (
          <div className="history-card-grid" aria-label="Historial en tarjetas">
            {filtered.map((row) => (
              <article className="history-card" key={`card-${row.id}`}>
                <div className="mobile-record-head">
                  <div>
                    <strong>{row.concepto}</strong>
                    <span>{formatShortDate(row.fecha)} · {row.id}</span>
                  </div>
                  <em className={getIngreso(row) > 0 ? 'income' : 'expense'}>
                    {getIngreso(row) > 0 ? '+' : '-'}{money(getMovementAmount(row))}
                  </em>
                </div>
                <div className="mobile-record-meta">
                  <span><b>Proveedor:</b> {row.proveedor}</span>
                  <span><b>Ingreso:</b> {getIngreso(row) > 0 ? money(getIngreso(row)) : '-'}</span>
                  <span><b>Egreso:</b> {getEgreso(row) > 0 ? money(getEgreso(row)) : '-'}</span>
                  <span className="balance-card-line"><b>Saldo acumulado:</b> {money(row.saldoAcumulado)}</span>
                  <span><b>Categoría:</b> {row.categoria || 'Sin categoría'}</span>
                  <span><b>Subcategoría:</b> {row.subcategoria || 'Sin subcategoría'}</span>
                  <span><b>Sincronización:</b> <SyncPill row={row} /></span>
                  {row.syncError ? <span className="danger-text"><b>Error:</b> {row.syncError}</span> : null}
                </div>
                <div className="row-actions mobile-actions">
                  <button className="small" type="button" onClick={() => onEdit(row)}>Editar</button>
                  <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
                </div>
              </article>
            ))}
            {filtered.length === 0 ? <div className="empty mobile-empty">No hay registros con esos filtros.</div> : null}
          </div>
        ) : (
          <>
            <p className="table-scroll-hint">Desliza la tabla hacia los lados para ver más columnas.</p>
            <div className="table-wrap home-history-table">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Concepto</th>
                    <th>Ingreso</th>
                    <th>Egreso</th>
                    <th>Saldo acumulado</th>
                    <th>Categoría</th>
                    <th>Subcategoría</th>
                    <th>Sync</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}>
                      <td>{formatShortDate(row.fecha)}</td>
                      <td>{row.proveedor}</td>
                      <td>{row.concepto}</td>
                      <td className="income-cell">{getIngreso(row) > 0 ? money(getIngreso(row)) : '-'}</td>
                      <td className="expense-cell">{getEgreso(row) > 0 ? money(getEgreso(row)) : '-'}</td>
                      <td className="balance-cell">{money(row.saldoAcumulado)}</td>
                      <td>{row.categoria || '-'}</td>
                      <td>{row.subcategoria || '-'}</td>
                      <td><SyncPill row={row} /></td>
                      <td className="row-actions">
                        <button className="small" type="button" onClick={() => onEdit(row)}>Editar</button>
                        <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 ? (
                    <tr><td colSpan="10" className="empty">No hay registros con esos filtros.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function getReminderSortKey(reminder) {
  return `${reminder.dueDate || '9999-12-31'} ${reminder.dueTime || '23:59'} ${reminder.createdAt || ''}`;
}

function getReminderState(reminder) {
  if (!reminder.dueDate) return { label: 'Sin fecha', className: 'neutral' };
  const today = todayISO();
  if (reminder.dueDate < today) return { label: 'Vencido', className: 'overdue' };
  if (reminder.dueDate === today) return { label: 'Para hoy', className: 'today' };
  if (reminder.dueDate === addDaysToISO(today, 1)) return { label: 'Para mañana', className: 'soon' };
  return { label: 'Programado', className: 'scheduled' };
}

function recurrenceLabelFromValue(value) {
  if (value === 'daily') return 'Cada día';
  if (value === 'weekly') return 'Cada semana';
  if (value === 'monthly') return 'Cada mes';
  if (value === 'yearly') return 'Cada año';
  return '';
}

function PendientesModule({ reminders, onUpdate, onComplete, onDelete }) {
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(null);

  const pending = useMemo(() => reminders
    .filter((item) => item.status !== 'done' && item.status !== 'deleted')
    .sort((a, b) => getReminderSortKey(a).localeCompare(getReminderSortKey(b))), [reminders]);

  const completed = useMemo(() => reminders
    .filter((item) => item.status === 'done')
    .sort((a, b) => String(b.completedAt || b.updatedAt || b.createdAt).localeCompare(String(a.completedAt || a.updatedAt || a.createdAt))), [reminders]);

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      text: item.text,
      dueDate: item.dueDate || '',
      dueTime: item.dueTime || '',
      recurrence: item.recurrence || 'none'
    });
  }

  function saveEdit(event) {
    event.preventDefault();
    if (!form?.text?.trim()) return;
    onUpdate(editingId, {
      text: form.text.trim(),
      dueDate: form.dueDate,
      dueTime: form.dueTime,
      recurrence: form.recurrence,
      recurrenceLabel: recurrenceLabelFromValue(form.recurrence)
    });
    setEditingId('');
    setForm(null);
  }

  return (
    <section className="panel reminders-page">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Tareas del asistente</p>
          <h2>Pendientes</h2>
          <p className="muted">Las tareas más próximas aparecen primero. Las que no tienen fecha quedan al final.</p>
        </div>
        <div className="reminder-counts">
          <strong>{pending.length} {pending.length === 1 ? 'pendiente' : 'pendientes'}</strong>
          <span>{completed.length} completadas</span>
        </div>
      </div>

      {editingId && form ? (
        <form className="reminder-edit-form" onSubmit={saveEdit}>
          <div className="reminder-edit-head">
            <div>
              <p className="eyebrow">Editar tarea</p>
              <h3>Modificar recordatorio</h3>
            </div>
            <button type="button" className="secondary" onClick={() => { setEditingId(''); setForm(null); }}>Cancelar</button>
          </div>
          <label className="wide">
            Tarea
            <textarea value={form.text} onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))} rows="3" />
          </label>
          <label>
            Fecha
            <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
          </label>
          <label>
            Hora
            <input type="time" value={form.dueTime} onChange={(event) => setForm((current) => ({ ...current, dueTime: event.target.value }))} />
          </label>
          <label>
            Repetición
            <select value={form.recurrence} onChange={(event) => setForm((current) => ({ ...current, recurrence: event.target.value }))}>
              <option value="none">No repetir</option>
              <option value="daily">Cada día</option>
              <option value="weekly">Cada semana</option>
              <option value="monthly">Cada mes</option>
              <option value="yearly">Cada año</option>
            </select>
          </label>
          <div className="actions wide">
            <button type="submit">Guardar cambios</button>
          </div>
        </form>
      ) : null}

      <div className="reminder-list">
        {pending.map((item) => {
          const state = getReminderState(item);
          return (
            <article className={`reminder-page-card ${state.className}`} key={item.id}>
              <div className="reminder-page-main">
                <div className="reminder-page-title">
                  <span className={`reminder-state ${state.className}`}>{state.label}</span>
                  <SyncPill row={item} />
                </div>
                <strong>{item.text}</strong>
                <span>{formatReminderDate(item.dueDate, item.dueTime, item.recurrenceLabel)}</span>
                {item.syncError ? <small className="danger-text">{item.syncError}</small> : null}
              </div>
              <div className="reminder-page-actions">
                <button type="button" onClick={() => onComplete(item.id)}>Completar</button>
                <button type="button" className="secondary" onClick={() => startEdit(item)}>Editar</button>
                <button type="button" className="danger-button" onClick={() => onDelete(item.id)}>Borrar</button>
              </div>
            </article>
          );
        })}
        {pending.length === 0 ? <div className="empty reminder-empty">No hay tareas pendientes.</div> : null}
      </div>

      <details className="completed-reminders" open={completed.length > 0 && pending.length === 0}>
        <summary>Completadas ({completed.length})</summary>
        <div className="reminder-list completed-list">
          {completed.map((item) => (
            <article className="reminder-page-card completed" key={item.id}>
              <div className="reminder-page-main">
                <div className="reminder-page-title"><span className="reminder-state completed">Completada</span><SyncPill row={item} /></div>
                <strong>{item.text}</strong>
                <span>{item.completedAt ? `Completada el ${formatShortDate(item.completedAt.slice(0, 10))}` : 'Completada'}</span>
              </div>
              <div className="reminder-page-actions">
                <button type="button" className="danger-button" onClick={() => onDelete(item.id)}>Borrar</button>
              </div>
            </article>
          ))}
          {completed.length === 0 ? <div className="empty reminder-empty">Todavía no hay tareas completadas.</div> : null}
        </div>
      </details>
    </section>
  );
}

function RafaModule({ rows, config, onCreate, onEdit, onDelete, saving }) {
  const [form, setForm] = useState(emptyRafa);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState(() => window.localStorage.getItem('control-gastos-rafa-view') || 'table');
  const isMobileView = useMediaQuery('(max-width: 720px)');
  const activeViewMode = isMobileView ? viewMode : 'table';

  useEffect(() => {
    window.localStorage.setItem('control-gastos-rafa-view', viewMode);
  }, [viewMode]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.id).localeCompare(String(a.id))),
    [rows]
  );

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function submit(event) {
    event.preventDefault();
    const validation = requireFields(form, ['fecha', 'concepto', 'monto', 'categoria']);
    if (validation) {
      setError(validation);
      return;
    }
    onCreate({ ...form, monto: parseAmount(form.monto) });
    setForm(emptyRafa);
    setError('');
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Módulo secundario</p>
          <h2>Gastos Rafa</h2>
        </div>
        <div className="history-head-actions">
          <strong>Total: {money(sumBy(rows, (row) => row.monto))}</strong>
          {isMobileView ? (
            <div className="view-switch" role="group" aria-label="Cambiar vista de gastos Rafa">
              <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Tabla</button>
              <button type="button" className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>Tarjetas</button>
            </div>
          ) : null}
        </div>
      </div>

      <form className="form-grid compact" onSubmit={submit}>
        <label>
          Fecha <span>*</span>
          <input type="date" value={form.fecha} onChange={(event) => update('fecha', event.target.value)} />
        </label>
        <label className="wide">
          Concepto <span>*</span>
          <input value={form.concepto} onChange={(event) => update('concepto', event.target.value)} />
        </label>
        <label>
          Monto <span>*</span>
          <input type="number" min="1" value={form.monto} onChange={(event) => update('monto', event.target.value)} />
        </label>
        <label>
          Categoría
          <select value={form.categoria} onChange={(event) => update('categoria', event.target.value)}>
            <option value="">Seleccionar</option>
            {config.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        {error ? <p className="form-error wide">{error}</p> : null}
        <div className="actions wide">
          <button type="submit" disabled={saving}>{saving ? 'Guardando...' : 'Guardar gasto Rafa'}</button>
        </div>
      </form>

      {activeViewMode === 'cards' ? (
        <div className="history-card-grid" aria-label="Gastos Rafa en tarjetas">
          {sortedRows.map((row) => (
            <article className="history-card" key={`rafa-card-${row.id}`}>
              <div className="mobile-record-head">
                <div>
                  <strong>{row.concepto}</strong>
                  <span>{formatShortDate(row.fecha)} · {row.id}</span>
                </div>
                <em className="expense">-{money(row.monto)}</em>
              </div>
              <div className="mobile-record-meta">
                <span><b>Fecha:</b> {formatShortDate(row.fecha)}</span>
                <span><b>Monto:</b> {money(row.monto)}</span>
                <span><b>Categoría:</b> {row.categoria || 'Sin categoría'}</span>
                <span><b>Sincronización:</b> <SyncPill row={row} /></span>
                {row.syncError ? <span className="danger-text"><b>Error:</b> {row.syncError}</span> : null}
              </div>
              <div className="row-actions mobile-actions">
                <button className="small" type="button" onClick={() => onEdit(row)}>Editar</button>
                <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
              </div>
            </article>
          ))}
          {sortedRows.length === 0 ? <div className="empty mobile-empty">No hay gastos de Rafa registrados.</div> : null}
        </div>
      ) : (
        <>
          <p className="table-scroll-hint">Desliza la tabla hacia los lados para ver más columnas.</p>
          <div className="table-wrap small-table rafa-history-table">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>Categoría</th>
                  <th>Sync</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{formatShortDate(row.fecha)}</td>
                    <td>{row.concepto}</td>
                    <td className="expense-cell">{money(row.monto)}</td>
                    <td>{row.categoria}</td>
                    <td><SyncPill row={row} /></td>
                    <td className="row-actions">
                      <button className="small" type="button" onClick={() => onEdit(row)}>Editar</button>
                      <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
                    </td>
                  </tr>
                ))}
                {sortedRows.length === 0 ? (
                  <tr><td colSpan="7" className="empty">No hay gastos de Rafa registrados.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}


function normalizeCommonMovement(row = {}) {
  const directIngreso = getIngreso(row);
  const directEgreso = getEgreso(row);
  const amount = parseAmount(row.monto);
  const movementType = normalizeText(row.tipoMovimiento || (directIngreso > 0 ? 'Ingreso' : 'Egreso'));
  const ingreso = directIngreso > 0 ? directIngreso : movementType === 'ingreso' ? amount : 0;
  const egreso = directEgreso > 0 ? directEgreso : ingreso <= 0 ? amount : 0;
  const fechaKey = toDateKey(row.fecha);
  return {
    ...row,
    proveedor: row.proveedor || '',
    concepto: row.concepto || '',
    ingreso,
    egreso,
    tipoMovimiento: ingreso > 0 ? 'Ingreso' : 'Egreso',
    monto: ingreso > 0 ? ingreso : egreso || parseAmount(row.monto),
    categoria: row.categoria || '',
    subcategoria: row.subcategoria || '',
    estado: row.estado || 'Activo',
    creadoEn: row.creadoEn || row.creado_en || '',
    actualizadoEn: row.actualizadoEn || row.actualizado_en || '',
    _ingreso: ingreso,
    _egreso: egreso,
    _neto: ingreso - egreso,
    _fechaKey: fechaKey,
    _monthKey: fechaKey ? fechaKey.slice(0, 7) : '',
    syncStatus: row.syncStatus || 'synced',
    syncError: row.syncError || ''
  };
}

function rowsWithRunningBalance(rows) {
  let runningBalance = 0;
  return [...rows].sort(compareOfficialRowsAsc).map((row) => {
    runningBalance += getIngreso(row) - getEgreso(row);
    return { ...row, saldoAcumulado: runningBalance };
  });
}

function accountFormInitial(row, account) {
  const source = row || {};
  return {
    fecha: source.fecha || todayISO(),
    proveedor: source.proveedor || '',
    concepto: source.concepto || '',
    tipoMovimiento: accountHasField(account, 'tipoMovimiento') ? (source.tipoMovimiento || getMovementType(source) || 'Egreso') : 'Egreso',
    monto: source.monto || getMovementAmount(source) || '',
    categoria: source.categoria || '',
    subcategoria: source.subcategoria || ''
  };
}

function AccountMovementForm({ account, config, initialData, editingId, saving, onSubmit, onCancel }) {
  const [form, setForm] = useState(() => accountFormInitial(initialData, account));
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setForm(accountFormInitial(initialData, account));
    setLocalError('');
  }, [initialData, account?.id]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const required = ['fecha', 'concepto', 'monto'];
    if (accountHasField(account, 'proveedor')) required.push('proveedor');
    if (account.id === 'rafa') required.push('categoria');
    const validation = requireFields(form, required);
    if (validation) {
      setLocalError(validation);
      return;
    }
    onSubmit(toOfficialPayload({
      ...form,
      proveedor: accountHasField(account, 'proveedor') ? form.proveedor : '',
      tipoMovimiento: accountHasField(account, 'tipoMovimiento') ? form.tipoMovimiento : 'Egreso',
      categoria: accountHasField(account, 'categoria') ? form.categoria : '',
      subcategoria: accountHasField(account, 'subcategoria') ? form.subcategoria : '',
      monto: parseAmount(form.monto)
    }));
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit}>
      <label>
        Fecha <span>*</span>
        <input type="date" value={form.fecha} onChange={(event) => update('fecha', event.target.value)} />
      </label>

      {accountHasField(account, 'proveedor') ? (
        <label>
          Proveedor <span>*</span>
          <input value={form.proveedor} onChange={(event) => update('proveedor', event.target.value)} placeholder="Ej. Supermercado" />
        </label>
      ) : null}

      <label className="wide">
        Concepto <span>*</span>
        <input value={form.concepto} onChange={(event) => update('concepto', event.target.value)} placeholder="Describe el movimiento" />
      </label>

      {accountHasField(account, 'tipoMovimiento') ? (
        <label>
          Tipo de movimiento <span>*</span>
          <select value={form.tipoMovimiento} onChange={(event) => update('tipoMovimiento', event.target.value)}>
            {(config.tiposMovimiento.length ? config.tiposMovimiento : ['Ingreso', 'Egreso']).map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      ) : null}

      <label>
        Monto <span>*</span>
        <input type="number" min="1" value={form.monto} onChange={(event) => update('monto', event.target.value)} placeholder="0" />
      </label>

      {accountHasField(account, 'categoria') ? (
        <label>
          Categoría {account.id === 'rafa' ? <span>*</span> : null}
          <select value={form.categoria} onChange={(event) => update('categoria', event.target.value)}>
            <option value="">Seleccionar</option>
            {config.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      ) : null}

      {accountHasField(account, 'subcategoria') ? (
        <label>
          Subcategoría
          <select value={form.subcategoria} onChange={(event) => update('subcategoria', event.target.value)}>
            <option value="">Seleccionar</option>
            {config.subcategorias.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      ) : null}

      {localError ? <p className="form-error wide">{localError}</p> : null}
      <div className="actions wide">
        <button type="submit" disabled={saving}>{saving ? 'Guardando...' : editingId ? 'Actualizar movimiento' : 'Guardar movimiento'}</button>
        {onCancel ? <button className="secondary" type="button" onClick={onCancel}>{editingId ? 'Cancelar edición' : 'Cerrar'}</button> : null}
      </div>
    </form>
  );
}

function AccountEditModal({ context, config, saving, onSubmit, onClose }) {
  const account = context?.account;
  const row = context?.row;
  return (
    <EditMovementModal
      open={Boolean(account && row)}
      eyebrow={account?.name || 'Hoja'}
      title={`Editar movimiento de ${account?.name || ''}`}
      onClose={onClose}
    >
      {account && row ? (
        <AccountMovementForm
          account={account}
          config={config}
          initialData={row}
          editingId={row.id}
          saving={saving}
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      ) : null}
    </EditMovementModal>
  );
}

function AccountModule({ account, rows, config, saving, onCreate, onEdit, onDelete }) {
  const [formOpen, setFormOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [viewMode, setViewMode] = useState(() => window.localStorage.getItem(`control-gastos-account-view-${account.id}`) || 'table');
  const isMobileView = useMediaQuery('(max-width: 720px)');
  const activeViewMode = isMobileView ? viewMode : 'table';

  useEffect(() => {
    window.localStorage.setItem(`control-gastos-account-view-${account.id}`, viewMode);
  }, [account.id, viewMode]);

  const balancedRows = useMemo(() => rowsWithRunningBalance(rows), [rows]);
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return balancedRows.filter((row) => {
      const matchesQuery = !q || [row.proveedor, row.concepto, row.categoria, row.subcategoria].some((value) => normalizeText(value).includes(q));
      const matchesType = !type || getMovementType(row) === type;
      const matchesCategory = !category || row.categoria === category;
      return matchesQuery && matchesType && matchesCategory && (!from || isDateInRange(row.fecha, from, '')) && (!to || isDateInRange(row.fecha, '', to));
    }).sort((a, b) => getRowDateKey(b).localeCompare(getRowDateKey(a)) || String(b.id).localeCompare(String(a.id)));
  }, [balancedRows, query, type, category, from, to]);

  const totalIngresos = sumBy(rows, getIngreso);
  const totalEgresos = sumBy(rows, getEgreso);
  const saldo = totalIngresos - totalEgresos;
  const showSplitAmounts = accountHasField(account, 'tipoMovimiento');

  return (
    <>
      <section className="panel home-header-panel">
        <div className="panel-head home-main-head">
          <div>
            <p className="eyebrow">{account.sheetName || 'Hoja de movimientos'}</p>
            <h2>{account.name}</h2>
            <p className="muted home-description">Registra movimientos y consulta su historial desde un solo lugar.</p>
          </div>
          <button type="button" onClick={() => setFormOpen((current) => !current)}>{formOpen ? 'Cerrar formulario' : '+ Nuevo registro'}</button>
        </div>
      </section>

      {formOpen ? (
        <section className="panel home-form-panel">
          <div className="panel-head"><div><p className="eyebrow">{account.name}</p><h2>Nuevo movimiento</h2></div></div>
          <AccountMovementForm account={account} config={config} saving={saving} onSubmit={(data) => { onCreate(data); setFormOpen(false); }} onCancel={() => setFormOpen(false)} />
        </section>
      ) : null}

      <section className="panel">
        <div className="account-summary-strip">
          <div><span>Ingresos</span><strong>{money(totalIngresos)}</strong></div>
          <div><span>Egresos</span><strong>{money(totalEgresos)}</strong></div>
          <div><span>Saldo</span><strong>{money(saldo)}</strong></div>
        </div>

        <div className="panel-head history-heading">
          <div><p className="eyebrow">Historial de movimientos</p><h2>{account.name}</h2></div>
          <div className="history-head-actions">
            <strong>{filtered.length} registros</strong>
            {isMobileView ? (
              <div className="view-switch" role="group" aria-label={`Cambiar vista de ${account.name}`}>
                <button type="button" className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>Tabla</button>
                <button type="button" className={viewMode === 'cards' ? 'active' : ''} onClick={() => setViewMode('cards')}>Tarjetas</button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por concepto o proveedor" />
          {showSplitAmounts ? (
            <select value={type} onChange={(event) => setType(event.target.value)}><option value="">Tipo: todos</option>{(config.tiposMovimiento.length ? config.tiposMovimiento : ['Ingreso', 'Egreso']).map((item) => <option key={item} value={item}>{item}</option>)}</select>
          ) : null}
          {accountHasField(account, 'categoria') ? (
            <select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Categoría: todas</option>{config.categorias.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          ) : null}
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="Fecha desde" />
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="Fecha hasta" />
        </div>

        {activeViewMode === 'cards' ? (
          <div className="history-card-grid">
            {filtered.map((row) => (
              <article className="history-card" key={`${account.id}-card-${row.id}`}>
                <div className="mobile-record-head">
                  <div><strong>{row.concepto}</strong><span>{formatShortDate(row.fecha)}</span></div>
                  <em className={getIngreso(row) > 0 ? 'income' : 'expense'}>{getIngreso(row) > 0 ? '+' : '-'}{money(getMovementAmount(row))}</em>
                </div>
                <div className="mobile-record-meta">
                  {accountHasField(account, 'proveedor') ? <span><b>Proveedor:</b> {row.proveedor || '-'}</span> : null}
                  {showSplitAmounts ? <><span><b>Ingreso:</b> {getIngreso(row) > 0 ? money(getIngreso(row)) : '-'}</span><span><b>Egreso:</b> {getEgreso(row) > 0 ? money(getEgreso(row)) : '-'}</span></> : <span><b>Monto:</b> {money(getMovementAmount(row))}</span>}
                  <span className="balance-card-line"><b>Saldo acumulado:</b> {money(row.saldoAcumulado)}</span>
                  {accountHasField(account, 'categoria') ? <span><b>Categoría:</b> {row.categoria || 'Sin categoría'}</span> : null}
                  {accountHasField(account, 'subcategoria') ? <span><b>Subcategoría:</b> {row.subcategoria || 'Sin subcategoría'}</span> : null}
                  <span><b>Sincronización:</b> <SyncPill row={row} /></span>
                  {row.syncError ? <span className="danger-text"><b>Error:</b> {row.syncError}</span> : null}
                </div>
                <div className="row-actions mobile-actions"><button className="small" type="button" onClick={() => onEdit(row)}>Editar</button><button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button></div>
              </article>
            ))}
            {filtered.length === 0 ? <div className="empty mobile-empty">No hay movimientos con esos filtros.</div> : null}
          </div>
        ) : (
          <>
            <p className="table-scroll-hint">Desliza la tabla hacia los lados para ver más columnas.</p>
            <div className="table-wrap home-history-table">
              <table>
                <thead><tr><th>Fecha</th>{accountHasField(account, 'proveedor') ? <th>Proveedor</th> : null}<th>Concepto</th>{showSplitAmounts ? <><th>Ingreso</th><th>Egreso</th></> : <th>Monto</th>}<th>Saldo acumulado</th>{accountHasField(account, 'categoria') ? <th>Categoría</th> : null}{accountHasField(account, 'subcategoria') ? <th>Subcategoría</th> : null}<th>Sync</th><th>Acciones</th></tr></thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id}><td>{formatShortDate(row.fecha)}</td>{accountHasField(account, 'proveedor') ? <td>{row.proveedor || '-'}</td> : null}<td>{row.concepto}</td>{showSplitAmounts ? <><td className="income-cell">{getIngreso(row) > 0 ? money(getIngreso(row)) : '-'}</td><td className="expense-cell">{getEgreso(row) > 0 ? money(getEgreso(row)) : '-'}</td></> : <td className="expense-cell">{money(getMovementAmount(row))}</td>}<td className="balance-cell">{money(row.saldoAcumulado)}</td>{accountHasField(account, 'categoria') ? <td>{row.categoria || '-'}</td> : null}{accountHasField(account, 'subcategoria') ? <td>{row.subcategoria || '-'}</td> : null}<td><SyncPill row={row} /></td><td className="row-actions"><button className="small" type="button" onClick={() => onEdit(row)}>Editar</button><button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button></td></tr>
                  ))}
                  {filtered.length === 0 ? <tr><td colSpan="10" className="empty">No hay movimientos con esos filtros.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

function DynamicDashboard({ accounts, rowsByAccount, month, setMonth }) {
  const [selectedAccount, setSelectedAccount] = useState('all');
  const initialRange = getMonthBounds(month);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(initialRange.from);
  const [rangeTo, setRangeTo] = useState(initialRange.to);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_DASHBOARD_COLUMNS);

  const selectedRows = useMemo(() => {
    const sourceAccounts = selectedAccount === 'all' ? accounts : accounts.filter((account) => account.id === selectedAccount);
    return sourceAccounts.flatMap((account) => (rowsByAccount[account.id] || []).map((row) => ({ ...row, accountId: account.id, accountName: account.name })));
  }, [accounts, rowsByAccount, selectedAccount]);

  const balancedRows = useMemo(() => rowsWithRunningBalance(selectedRows), [selectedRows]);
  const monthRows = balancedRows.filter((row) => (row._monthKey || getMonthKey(row.fecha)) === month);
  const rangeRows = balancedRows.filter((row) => isDateInRange(row.fecha, rangeFrom, rangeTo));
  const totalIngresos = sumBy(monthRows, getIngreso);
  const totalEgresos = sumBy(monthRows, getEgreso);
  const saldoMes = monthRows.length ? monthRows[monthRows.length - 1].saldoAcumulado : 0;
  const saldoTotal = balancedRows.length ? balancedRows[balancedRows.length - 1].saldoAcumulado : 0;
  const rangeIngresos = sumBy(rangeRows, getIngreso);
  const rangeEgresos = sumBy(rangeRows, getEgreso);
  const byCategory = Object.entries(monthRows.reduce((acc, row) => { if (getEgreso(row) > 0) acc[row.categoria || 'Sin categoría'] = (acc[row.categoria || 'Sin categoría'] || 0) + getEgreso(row); return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const lastRows = [...selectedRows].sort((a, b) => getRowDateKey(b).localeCompare(getRowDateKey(a)) || String(b.id).localeCompare(String(a.id))).slice(0, 6);
  const tableColumns = selectedAccount === 'all' ? [{ key: 'accountName', label: 'Hoja' }, ...DASHBOARD_TABLE_COLUMNS] : DASHBOARD_TABLE_COLUMNS;

  function renderCell(row, key) {
    if (key === 'accountName') return row.accountName;
    if (key === 'fecha') return formatShortDate(row.fecha);
    if (key === 'proveedor') return row.proveedor || '-';
    if (key === 'concepto') return row.concepto || '-';
    if (key === 'ingreso') return getIngreso(row) > 0 ? money(getIngreso(row)) : '-';
    if (key === 'egreso') return getEgreso(row) > 0 ? money(getEgreso(row)) : '-';
    if (key === 'categoria') return row.categoria || '-';
    if (key === 'subcategoria') return row.subcategoria || '-';
    if (key === 'saldoAcumulado') return money(row.saldoAcumulado);
    return '-';
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div><p className="eyebrow">Resumen consolidado</p><h2>Dashboard</h2></div>
        <div className="dashboard-selector-group">
          <label>Hoja<select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)}><option value="all">Todas las hojas</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="month-picker">Mes<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label>
        </div>
      </div>
      <div className="cards-grid"><Card title="Ingresos del mes" value={money(totalIngresos)} /><Card title="Egresos del mes" value={money(totalEgresos)} /><Card title="Saldo del mes" value={money(saldoMes)} /><Card title="Saldo acumulado" value={money(saldoTotal)} detail={selectedAccount === 'all' ? 'Todas las hojas visibles' : 'Hoja seleccionada'} /></div>
      <div className="dashboard-tools"><div><p className="eyebrow">Movimientos por rango</p><h3>Historial con saldo acumulado</h3><p className="muted range-caption">{rangeFrom || 'sin fecha inicial'} a {rangeTo || 'sin fecha final'} · {rangeRows.length} registros</p></div><div className="dashboard-tool-actions"><button className="secondary" type="button" onClick={() => setRangeOpen((current) => !current)}>{rangeOpen ? 'Ocultar rango' : 'Seleccionar rango'}</button><button className="secondary" type="button" onClick={() => { const next = getMonthBounds(month); setRangeFrom(next.from); setRangeTo(next.to); setRangeOpen(true); }}>Usar mes seleccionado</button></div></div>
      {rangeOpen ? <div className="date-range-panel"><label>Desde<input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} /></label><label>Hasta<input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} /></label><button className="secondary" type="button" onClick={() => { setRangeFrom(''); setRangeTo(''); }}>Ver todo</button></div> : null}
      <div className="range-summary-grid"><Card title="Ingresos del rango" value={money(rangeIngresos)} /><Card title="Egresos del rango" value={money(rangeEgresos)} /><Card title="Saldo del rango" value={money(rangeIngresos - rangeEgresos)} /></div>
      <details className="column-toggle-panel"><summary>Mostrar columnas</summary><div className="column-toggle-list">{tableColumns.map((column) => <label className="checkbox-chip" key={column.key}><input type="checkbox" checked={column.key === 'accountName' || visibleColumns.includes(column.key)} disabled={column.key === 'accountName'} onChange={() => setVisibleColumns((current) => current.includes(column.key) ? (current.length > 1 ? current.filter((item) => item !== column.key) : current) : [...current, column.key])} /><span>{column.label}</span></label>)}</div></details>
      <p className="table-scroll-hint">Desliza la tabla hacia los lados para ver más columnas.</p>
      <div className="table-wrap dashboard-table-wrap"><table><thead><tr>{tableColumns.filter((column) => column.key === 'accountName' || visibleColumns.includes(column.key)).map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rangeRows.map((row) => <tr key={`${row.accountId}-${row.id}`}>{tableColumns.filter((column) => column.key === 'accountName' || visibleColumns.includes(column.key)).map((column) => <td key={column.key} className={getDashboardCellClass(column.key)}>{renderCell(row, column.key)}</td>)}</tr>)}{rangeRows.length === 0 ? <tr><td colSpan="10" className="empty">No hay registros en este rango.</td></tr> : null}</tbody></table></div>
      <div className="two-col dashboard-bottom-panels"><article className="subpanel"><h3>Gastos por categoría</h3>{byCategory.length ? <div className="category-list">{byCategory.map(([categoryName, total]) => <div className="category-row" key={categoryName}><span>{categoryName}</span><strong>{money(total)}</strong></div>)}</div> : <p className="muted">No hay egresos para este mes.</p>}</article><article className="subpanel"><h3>Últimos movimientos</h3><div className="mini-list">{lastRows.map((row) => <div className="mini-row" key={`${row.accountId}-${row.id}`}><div><strong>{row.concepto}</strong><span>{row.accountName} · {formatShortDate(row.fecha)}</span></div><em className={getIngreso(row) > 0 ? 'income' : 'expense'}>{getIngreso(row) > 0 ? '+' : '-'}{money(getMovementAmount(row))}</em></div>)}</div></article></div>
    </section>
  );
}

function DynamicConfigPanel({ config, accounts, busy, onCreateAccount, onUpdateAccount, onDeactivateAccount }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: '', sheetName: '', visible: true, fields: DEFAULT_ACCOUNT_FIELDS });
  const [drafts, setDrafts] = useState({});
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setDrafts(Object.fromEntries(accounts.map((account) => [account.id, { ...account, fields: [...account.fields] }])));
  }, [accounts]);

  function toggleNewField(field) {
    setNewAccount((current) => ({ ...current, fields: current.fields.includes(field) ? current.fields.filter((item) => item !== field) : [...current.fields, field] }));
  }

  async function submitNew(event) {
    event.preventDefault();
    if (!newAccount.name.trim()) { setLocalError('Escribe el nombre de la nueva hoja.'); return; }
    const created = await onCreateAccount({ ...newAccount, name: newAccount.name.trim(), sheetName: newAccount.sheetName.trim() });
    if (created) {
      setNewAccount({ name: '', sheetName: '', visible: true, fields: DEFAULT_ACCOUNT_FIELDS });
      setCreateOpen(false);
      setLocalError('');
    }
  }

  function patchDraft(id, changes) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
  }

  function toggleDraftField(id, field) {
    const draft = drafts[id];
    if (!draft) return;
    const fields = draft.fields.includes(field) ? draft.fields.filter((item) => item !== field) : [...draft.fields, field];
    patchDraft(id, { fields });
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">Administración dinámica</p><h2>Hojas de movimientos</h2><p className="muted">Mile corresponde a la antigua Tabla Oficial. Puedes crear nuevas hojas sin modificar el código.</p></div><button type="button" onClick={() => setCreateOpen((current) => !current)}>{createOpen ? 'Cerrar' : '+ Nueva hoja'}</button></div>
        {createOpen ? (
          <form className="sheet-create-form" onSubmit={submitNew}>
            <label>Nombre visible <span>*</span><input value={newAccount.name} onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))} placeholder="Ej. Hogar" /></label>
            <label>Nombre en Google Sheets<input value={newAccount.sheetName} onChange={(event) => setNewAccount((current) => ({ ...current, sheetName: event.target.value }))} placeholder="Se crea automáticamente" /></label>
            <label className="checkbox-line"><input type="checkbox" checked={newAccount.visible} onChange={(event) => setNewAccount((current) => ({ ...current, visible: event.target.checked }))} /> Mostrar en el menú</label>
            <div className="field-selector wide"><strong>Campos visibles</strong><div>{ACCOUNT_FIELD_OPTIONS.map((option) => <label className="checkbox-chip" key={option.key}><input type="checkbox" checked={newAccount.fields.includes(option.key)} onChange={() => toggleNewField(option.key)} /><span>{option.label}</span></label>)}</div><small>Fecha, concepto y monto siempre estarán disponibles.</small></div>
            {localError ? <p className="form-error wide">{localError}</p> : null}
            <div className="actions wide"><button type="submit" disabled={busy}>{busy ? 'Creando...' : 'Crear hoja en Google Sheets'}</button></div>
          </form>
        ) : null}
        <div className="accounts-config-list">
          {accounts.map((account) => {
            const draft = drafts[account.id] || account;
            return (
              <article className="account-config-card" key={account.id}>
                <div className="account-config-title"><div><strong>{account.name}</strong><span>{account.sheetName} · {account.type === 'dynamic' ? 'Dinámica' : 'Existente'}</span></div><span className={account.visible ? 'account-visible-badge' : 'account-hidden-badge'}>{account.visible ? 'En menú' : 'Oculta'}</span></div>
                <div className="account-config-grid">
                  <label>Nombre visible<input value={account.id === 'mile' ? 'Mile' : (draft.name || '')} disabled={account.id === 'mile'} onChange={(event) => patchDraft(account.id, { name: event.target.value })} /></label>
                  <label>Orden<input type="number" min="1" value={draft.order || 1} onChange={(event) => patchDraft(account.id, { order: Number(event.target.value) })} /></label>
                  <label className="checkbox-line"><input type="checkbox" checked={draft.visible !== false} onChange={(event) => patchDraft(account.id, { visible: event.target.checked })} /> Mostrar en navegación</label>
                </div>
                <div className="field-selector"><strong>Campos de esta hoja</strong><div>{ACCOUNT_FIELD_OPTIONS.map((option) => <label className="checkbox-chip" key={option.key}><input type="checkbox" checked={(draft.fields || []).includes(option.key)} onChange={() => toggleDraftField(account.id, option.key)} /><span>{option.label}</span></label>)}</div></div>
                <div className="account-config-actions"><button type="button" onClick={() => onUpdateAccount(account.id, { name: draft.name, visible: draft.visible, order: draft.order, fields: draft.fields })} disabled={busy}>Guardar cambios</button>{account.type === 'dynamic' ? <button type="button" className="secondary danger-button" onClick={() => onDeactivateAccount(account)} disabled={busy}>Archivar hoja</button> : null}</div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel"><div className="panel-head"><div><p className="eyebrow">Listas desde Google Sheets</p><h2>Categorías y tipos</h2></div></div><div className="three-col"><article className="subpanel"><h3>Categorías</h3><ul className="tag-list">{config.categorias.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="subpanel"><h3>Tipo de movimiento</h3><ul className="tag-list">{config.tiposMovimiento.map((item) => <li key={item}>{item}</li>)}</ul></article><article className="subpanel"><h3>Subcategorías</h3><ul className="tag-list">{config.subcategorias.map((item) => <li key={item}>{item}</li>)}</ul></article></div><p className="muted note">Estas listas continúan administrándose desde la pestaña Configuracion de Google Sheets.</p></section>
    </>
  );
}

function ConfigPanel({ config }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Listas desde Google Sheets</p>
          <h2>Configuración</h2>
        </div>
      </div>
      <div className="three-col">
        <article className="subpanel">
          <h3>Categorías</h3>
          <ul className="tag-list">{config.categorias.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="subpanel">
          <h3>Tipo de movimiento</h3>
          <ul className="tag-list">{config.tiposMovimiento.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article className="subpanel">
          <h3>Subcategorías</h3>
          <ul className="tag-list">{config.subcategorias.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
      </div>
      <p className="muted note">
        Estas listas se administran directamente desde la pestaña Configuracion de Google Sheets. En la Tabla Oficial, Categoría y Subcategoría son opcionales.
      </p>
    </section>
  );
}

function normalizeLoadedData(data = {}) {
  const safeConfig = data.config || { categorias: [], tiposMovimiento: [], subcategorias: [] };
  const fallbackAccounts = [
    normalizeAccount({ id: 'mile', name: 'Mile', sheetName: 'Tabla Oficial', type: 'legacy_mile', primary: true, visible: true, order: 1, fields: DEFAULT_ACCOUNT_FIELDS }),
    normalizeAccount({ id: 'rafa', name: 'Rafa', sheetName: 'Gastos Rafa', type: 'legacy_rafa', visible: true, order: 2, fields: ['fecha', 'concepto', 'monto', 'categoria'] })
  ];
  const accounts = (data.accounts?.length ? data.accounts : fallbackAccounts)
    .map(normalizeAccount)
    .filter((account) => account.id && account.active)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  const mileRows = (data.mile || [])
    .filter((row) => normalizeText(row.estado || 'Activo') !== 'eliminado')
    .map(normalizeCommonMovement);

  const rafaRows = (data.rafa || []).map((row) => normalizeCommonMovement({
    ...row,
    proveedor: row.proveedor || '',
    ingreso: 0,
    egreso: parseAmount(row.egreso || row.monto),
    tipoMovimiento: 'Egreso',
    monto: parseAmount(row.monto || row.egreso),
    subcategoria: row.subcategoria || ''
  }));

  const dynamicMovements = Object.fromEntries(
    Object.entries(data.dynamicMovements || {}).map(([accountId, rows]) => [
      accountId,
      (rows || [])
        .filter((row) => normalizeText(row.estado || 'Activo') !== 'eliminado')
        .map(normalizeCommonMovement)
    ])
  );

  const reminderRows = (data.reminders || [])
    .map(normalizeReminderData)
    .filter((row) => row.text.trim() && row.status !== 'deleted');

  return {
    config: safeConfig,
    accounts,
    mile: mileRows,
    rafa: rafaRows,
    dynamicMovements,
    reminders: reminderRows
  };
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [month, setMonth] = useState(currentMonthKey());
  const [config, setConfig] = useState({ categorias: [], tiposMovimiento: [], subcategorias: [] });
  const [accounts, setAccounts] = useState(() => normalizeLoadedData({}).accounts);
  const [mile, setMile] = useState([]);
  const [rafa, setRafa] = useState([]);
  const [dynamicMovements, setDynamicMovements] = useState({});
  const [reminders, setReminders] = useState(() => readStoredReminders());
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cachedAt, setCachedAt] = useState('');
  const [editingContext, setEditingContext] = useState(null);
  const [syncQueue, setSyncQueueState] = useState(() => getSyncQueue());
  const [syncing, setSyncing] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState(null);
  const [connectionGuard, setConnectionGuard] = useState(() => ({
    checked: false,
    ok: false,
    blocked: false,
    message: 'Validación pendiente.',
    lastGood: getLastGoodDiagnostic()
  }));

  const mileRef = useRef(mile);
  const rafaRef = useRef(rafa);
  const dynamicRef = useRef(dynamicMovements);
  const remindersRef = useRef(reminders);
  const queueRef = useRef(syncQueue);
  const idMapRef = useRef(getIdMap());
  const syncTimerRef = useRef(null);
  const syncingRef = useRef(false);
  const connectionGuardRef = useRef(connectionGuard);

  const pendingSyncCount = syncQueue.filter((item) => item.status !== 'done').length;
  const failedSyncCount = syncQueue.filter((item) => item.status === 'failed').length;

  const rowsByAccount = useMemo(() => {
    const result = { mile, rafa };
    accounts.forEach((account) => {
      if (account.id !== 'mile' && account.id !== 'rafa') result[account.id] = dynamicMovements[account.id] || [];
    });
    return result;
  }, [accounts, mile, rafa, dynamicMovements]);

  const navItems = useMemo(() => [
    ...FIXED_NAV_START,
    ...accounts.filter((account) => account.visible && account.active).sort((a, b) => a.order - b.order).map((account) => ({ id: `account:${account.id}`, label: account.name })),
    ...FIXED_NAV_END
  ], [accounts]);

  const activeAccountId = active.startsWith('account:') ? active.slice(8) : '';
  const activeAccount = accounts.find((account) => account.id === activeAccountId) || null;

  useEffect(() => { mileRef.current = mile; }, [mile]);
  useEffect(() => { rafaRef.current = rafa; }, [rafa]);
  useEffect(() => { dynamicRef.current = dynamicMovements; }, [dynamicMovements]);
  useEffect(() => { remindersRef.current = reminders; }, [reminders]);
  useEffect(() => { saveStoredReminders(reminders); }, [reminders]);
  useEffect(() => { queueRef.current = syncQueue; }, [syncQueue]);
  useEffect(() => { connectionGuardRef.current = connectionGuard; }, [connectionGuard]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const dynamicCount = Object.values(dynamicMovements).reduce((total, rows) => total + rows.length, 0);
    if (config.categorias.length || accounts.length || mile.length || rafa.length || dynamicCount || reminders.length) {
      saveWorkingSnapshot({ config, accounts, mile, rafa, dynamicMovements, reminders });
    }
  }, [config, accounts, mile, rafa, dynamicMovements, reminders]);

  function setSyncQueue(nextQueue) {
    const cleanQueue = Array.isArray(nextQueue) ? nextQueue.filter((item) => item.status !== 'done') : [];
    queueRef.current = cleanQueue;
    saveSyncQueue(cleanQueue);
    setSyncQueueState(cleanQueue);
  }

  function updateSyncQueue(updater) {
    const nextQueue = typeof updater === 'function' ? updater(queueRef.current) : updater;
    setSyncQueue(nextQueue);
  }

  function mergeRows(remoteRows, localRows) {
    const result = [...(remoteRows || [])];
    (localRows || []).filter((row) => ['pending', 'syncing', 'failed'].includes(row.syncStatus)).forEach((localRow) => {
      const realId = resolveSyncedId(localRow.id, idMapRef.current);
      const existingIndex = result.findIndex((row) => row.id === localRow.id || row.id === realId);
      const rowToKeep = { ...localRow, id: existingIndex >= 0 ? result[existingIndex].id : localRow.id };
      if (existingIndex >= 0) result[existingIndex] = rowToKeep;
      else result.unshift(rowToKeep);
    });
    return result;
  }

  function applyLoadedData(data, options = {}) {
    const { keepPendingLocal = true } = options;
    const normalized = normalizeLoadedData(data);
    const localSnapshot = getWorkingSnapshot()?.data;
    const localNormalized = localSnapshot ? normalizeLoadedData(localSnapshot) : null;
    const hasPending = queueRef.current.some((item) => item.status !== 'done');

    if (keepPendingLocal && hasPending && localNormalized) {
      setConfig(normalized.config.categorias.length || normalized.config.tiposMovimiento.length || normalized.config.subcategorias.length ? normalized.config : localNormalized.config);
      setAccounts(normalized.accounts.length ? normalized.accounts : localNormalized.accounts);
      setMile(mergeRows(normalized.mile, localNormalized.mile));
      setRafa(mergeRows(normalized.rafa, localNormalized.rafa));
      const accountIds = new Set([...Object.keys(normalized.dynamicMovements), ...Object.keys(localNormalized.dynamicMovements)]);
      setDynamicMovements(Object.fromEntries([...accountIds].map((accountId) => [accountId, mergeRows(normalized.dynamicMovements[accountId] || [], localNormalized.dynamicMovements[accountId] || [])])));
      setReminders(mergeRows(normalized.reminders, localNormalized.reminders));
      return;
    }

    setConfig(normalized.config);
    setAccounts(normalized.accounts);
    setMile(normalized.mile);
    setRafa(normalized.rafa);
    setDynamicMovements(normalized.dynamicMovements);
    setReminders(normalized.reminders);
  }

  function updateConnectionGuard(result) {
    const guard = buildConnectionGuardFromDiagnostic(result);
    connectionGuardRef.current = guard;
    setConnectionGuard(guard);
    return guard;
  }

  async function validateConnectionSilently(options = {}) {
    const { openOnFailure = false } = options;
    try {
      const result = await runConnectionDiagnostic();
      const guard = updateConnectionGuard(result);
      if (guard.blocked) {
        setDiagnosticResult(result);
        if (openOnFailure) setDiagnosticOpen(true);
      }
      return guard;
    } catch (err) {
      const result = { ok: false, message: err.message || 'No se pudo validar la conexión.' };
      const guard = updateConnectionGuard(result);
      if (openOnFailure) {
        setDiagnosticResult(result);
        setDiagnosticOpen(true);
      }
      return guard;
    }
  }

  async function ensureConnectionReadyForSync(openOnFailure = true) {
    const currentGuard = connectionGuardRef.current;
    if (currentGuard?.checked && currentGuard.blocked) {
      setError(`Blindaje activo: ${currentGuard.message}`);
      if (openOnFailure) setDiagnosticOpen(true);
      return false;
    }
    if (!currentGuard?.checked) {
      const guard = await validateConnectionSilently({ openOnFailure });
      if (guard.blocked) {
        setError(`Blindaje activo: ${guard.message}`);
        return false;
      }
    }
    return true;
  }

  async function loadData(options = {}) {
    const { silent = false, preferCache = true } = options;
    const working = getWorkingSnapshot();
    const cached = getCachedRemoteSnapshot();
    const dynamicCount = Object.values(dynamicRef.current).reduce((total, rows) => total + rows.length, 0);
    const hasLocalData = mileRef.current.length > 0 || rafaRef.current.length > 0 || dynamicCount > 0 || remindersRef.current.length > 0;

    if (!silent) {
      setLoading(true);
      setError('');
      if (preferCache && working?.data && !hasLocalData) {
        applyLoadedData(working.data, { keepPendingLocal: true });
        setCachedAt(working.savedAt || 'copia local');
      } else if (preferCache && cached?.data && !hasLocalData) {
        applyLoadedData(cached.data, { keepPendingLocal: true });
        setCachedAt(cached.savedAt || 'copia local');
      } else setCachedAt('');
    }

    try {
      const response = await sheetsRequest('bootstrap');
      applyLoadedData(response.data, { keepPendingLocal: true });
      setDemoMode(Boolean(response.demo));
      setCachedAt('');
      if (!silent) setError('');
    } catch (err) {
      if (!silent) {
        if (working?.data && !hasLocalData) {
          applyLoadedData(working.data, { keepPendingLocal: true });
          setCachedAt(working.savedAt || 'copia local');
        } else if (cached?.data && !hasLocalData) {
          applyLoadedData(cached.data, { keepPendingLocal: true });
          setCachedAt(cached.savedAt || 'copia local');
        }
        setError(err.message || 'No se pudieron cargar los datos.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  function scheduleSync(delay = SYNC_DELAY_MS) {
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => processSyncQueue(), delay);
  }

  function enqueueSyncOperation(operation) {
    updateSyncQueue((current) => [...current, operation]);
    scheduleSync();
  }

  function setRowsForAccount(accountId, updater) {
    if (accountId === 'mile') setMile(updater);
    else if (accountId === 'rafa') setRafa(updater);
    else setDynamicMovements((current) => ({ ...current, [accountId]: typeof updater === 'function' ? updater(current[accountId] || []) : updater }));
  }

  function markRowsByOperation(operation, status, syncError = '') {
    const resolvedId = resolveSyncedId(operation.id, idMapRef.current);
    const updater = (rows) => rows.map((row) => row.id === operation.id || row.id === resolvedId ? { ...row, syncStatus: status, syncError } : row);
    if (operation.entity === 'reminder') setReminders(updater);
    else if (operation.entity === 'mile') setMile(updater);
    else if (operation.entity === 'rafa') setRafa(updater);
    else if (operation.entity.startsWith('movement:')) setRowsForAccount(operation.entity.slice(9), updater);
  }

  function applySyncedResponse(operation, responseData) {
    const normalizedData = responseData || null;
    const idMap = { ...idMapRef.current };
    if (operation.action === 'create' && normalizedData?.id && operation.id && normalizedData.id !== operation.id) {
      idMap[operation.id] = normalizedData.id;
      idMapRef.current = idMap;
      saveIdMap(idMap);
    }
    if (operation.action === 'delete') return;
    if (!normalizedData) { markRowsByOperation(operation, 'synced'); return; }

    if (operation.entity === 'reminder') {
      const normalized = normalizeReminderData({ ...normalizedData, syncStatus: 'synced', syncError: '' });
      setReminders((current) => current.map((row) => {
        const realId = resolveSyncedId(row.id, idMap);
        return row.id === operation.id || row.id === normalized.id || realId === normalized.id ? normalized : row;
      }));
      return;
    }

    const normalized = normalizeCommonMovement({ ...normalizedData, syncStatus: 'synced', syncError: '' });
    const accountId = operation.entity === 'mile' || operation.entity === 'rafa' ? operation.entity : operation.entity.slice(9);
    setRowsForAccount(accountId, (current) => current.map((row) => {
      const realId = resolveSyncedId(row.id, idMap);
      return row.id === operation.id || row.id === normalized.id || realId === normalized.id ? normalized : row;
    }));
  }

  async function processSyncQueue(force = false) {
    if (syncingRef.current) return;
    const available = queueRef.current.filter((item) => ['pending', 'failed', 'syncing'].includes(item.status));
    if (!available.length) return;
    const ready = await ensureConnectionReadyForSync(true);
    if (!ready) return;
    syncingRef.current = true;
    setSyncing(true);
    setError('');
    try {
      let workingQueue = [...queueRef.current];
      for (const item of available) {
        const currentItem = workingQueue.find((op) => op.opId === item.opId);
        if (!currentItem) continue;
        if (currentItem.status === 'failed' && !force && currentItem.attempts >= 3) continue;
        workingQueue = workingQueue.map((op) => op.opId === currentItem.opId ? { ...op, status: 'syncing', lastError: '' } : op);
        setSyncQueue(workingQueue);
        markRowsByOperation(currentItem, 'syncing');
        try {
          const resolvedId = resolveSyncedId(currentItem.id, idMapRef.current);
          const payload = currentItem.action === 'create'
            ? { entity: currentItem.entity, data: currentItem.data }
            : { entity: currentItem.entity, id: resolvedId, data: currentItem.data || undefined, lastKnownUpdatedAt: currentItem.lastKnownUpdatedAt || '' };
          const response = await sheetsRequest(currentItem.action, payload);
          applySyncedResponse({ ...currentItem, id: resolvedId }, response?.data);
          workingQueue = workingQueue.filter((op) => op.opId !== currentItem.opId);
          setSyncQueue(workingQueue);
          setNotice('Sincronizado');
        } catch (err) {
          const message = err.message || 'No se pudo sincronizar este cambio.';
          workingQueue = workingQueue.map((op) => op.opId === currentItem.opId ? { ...op, status: 'failed', attempts: (op.attempts || 0) + 1, lastError: message, lastTriedAt: new Date().toISOString() } : op);
          setSyncQueue(workingQueue);
          markRowsByOperation(currentItem, 'failed', message);
          setError('Hay cambios pendientes que no pudieron sincronizarse. Toca “Sincronizar ahora” para reintentar.');
          if (!force) break;
        }
      }
      if (!workingQueue.length) await loadData({ silent: true, preferCache: false });
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function startApp() {
      const guard = await validateConnectionSilently({ openOnFailure: false });
      if (cancelled) return;
      await loadData();
      if (!cancelled && queueRef.current.length > 0 && !guard.blocked) scheduleSync(1200);
    }
    startApp();
    const onOnline = () => processSyncQueue(true);
    window.addEventListener('online', onOnline);
    return () => {
      cancelled = true;
      window.removeEventListener('online', onOnline);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  async function openDiagnosticPanel() {
    setDiagnosticOpen(true);
    setDiagnosticLoading(true);
    setDiagnosticResult(null);
    try {
      const result = await runConnectionDiagnostic();
      setDiagnosticResult(result);
      updateConnectionGuard(result);
    } catch (err) {
      const result = { ok: false, message: err.message || 'No se pudo ejecutar el diagnóstico.' };
      setDiagnosticResult(result);
      updateConnectionGuard(result);
    } finally { setDiagnosticLoading(false); }
  }

  function backendMovementData(account, data) {
    if (account.id === 'rafa') return { fecha: data.fecha, concepto: data.concepto, monto: getMovementAmount(data), categoria: data.categoria || '' };
    return data;
  }

  function saveAccountMovement(account, data) {
    setError('');
    setNotice(editingContext ? 'Movimiento actualizado local' : 'Guardado local');
    const entity = accountEntity(account.id);
    const payloadData = backendMovementData(account, data);
    const editingRow = editingContext?.account?.id === account.id ? editingContext.row : null;

    if (editingRow) {
      const updated = normalizeCommonMovement({ ...editingRow, ...data, id: editingRow.id, syncStatus: 'pending', syncError: '' });
      setRowsForAccount(account.id, (current) => current.map((row) => row.id === editingRow.id ? updated : row));
      enqueueSyncOperation(createOperation('update', entity, { id: editingRow.id, data: payloadData, lastKnownUpdatedAt: editingRow.actualizadoEn || '' }));
    } else {
      const tempId = createTempId(account.id === 'mile' ? 'TO' : account.id === 'rafa' ? 'R' : account.id.toUpperCase().slice(0, 5));
      const localCreated = normalizeCommonMovement({ ...data, id: tempId, creadoEn: new Date().toISOString().slice(0, 19), actualizadoEn: '', estado: 'Activo', syncStatus: 'pending', syncError: '' });
      setRowsForAccount(account.id, (current) => [localCreated, ...current]);
      enqueueSyncOperation(createOperation('create', entity, { id: tempId, data: payloadData }));
    }
    setEditingContext(null);
    setActive(`account:${account.id}`);
  }

  function deleteAccountMovement(account, row) {
    if (!window.confirm(`¿Seguro que deseas borrar este movimiento de ${account.name}? Los datos de la hoja se conservarán mediante eliminación lógica cuando aplique.`)) return;
    setRowsForAccount(account.id, (current) => current.filter((item) => item.id !== row.id));
    enqueueSyncOperation(createOperation('delete', accountEntity(account.id), { id: row.id, lastKnownUpdatedAt: row.actualizadoEn || '' }));
    setNotice('Borrado local');
  }

  async function createAccount(data) {
    setConfigBusy(true);
    setError('');
    try {
      const ready = await ensureConnectionReadyForSync(true);
      if (!ready) return null;
      const response = await sheetsRequest('create', { entity: 'account', data });
      const account = normalizeAccount(response.data);
      setAccounts((current) => [...current, account].sort((a, b) => a.order - b.order));
      setDynamicMovements((current) => ({ ...current, [account.id]: [] }));
      setNotice(`Hoja ${account.name} creada`);
      setActive(`account:${account.id}`);
      return account;
    } catch (err) {
      setError(err.message || 'No se pudo crear la hoja.');
      return null;
    } finally { setConfigBusy(false); }
  }

  async function updateAccount(accountId, changes) {
    setConfigBusy(true);
    setError('');
    try {
      const ready = await ensureConnectionReadyForSync(true);
      if (!ready) return null;
      const response = await sheetsRequest('update', { entity: 'account', id: accountId, data: changes });
      const updated = normalizeAccount(response.data);
      setAccounts((current) => current.map((account) => account.id === accountId ? updated : account).sort((a, b) => a.order - b.order));
      setNotice('Configuración de hoja actualizada');
      return updated;
    } catch (err) {
      setError(err.message || 'No se pudo actualizar la hoja.');
      return null;
    } finally { setConfigBusy(false); }
  }

  async function deactivateAccount(account) {
    if (!window.confirm(`¿Archivar la hoja ${account.name}? La pestaña y sus datos permanecerán en Google Sheets, pero dejarán de aparecer en la aplicación.`)) return;
    setConfigBusy(true);
    try {
      const ready = await ensureConnectionReadyForSync(true);
      if (!ready) return;
      await sheetsRequest('delete', { entity: 'account', id: account.id });
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setDynamicMovements((current) => { const next = { ...current }; delete next[account.id]; return next; });
      if (active === `account:${account.id}`) setActive('dashboard');
      setNotice('Hoja archivada');
    } catch (err) {
      setError(err.message || 'No se pudo archivar la hoja.');
    } finally { setConfigBusy(false); }
  }

  function createReminder(parsed) {
    setError('');
    setNotice('Recordatorio guardado local');
    const tempId = createTempId('REM');
    const localReminder = normalizeReminderData({ id: tempId, text: parsed.text, dueDate: parsed.dueDate, dueTime: parsed.dueTime, recurrence: parsed.recurrence, recurrenceLabel: parsed.recurrenceLabel, status: 'pending', createdAt: new Date().toISOString(), updatedAt: '', completedAt: '', syncStatus: 'pending', syncError: '' });
    setReminders((current) => [localReminder, ...current]);
    enqueueSyncOperation(createOperation('create', 'reminder', { id: tempId, data: localReminder }));
    return localReminder;
  }

  function completeReminder(id) {
    const reminder = remindersRef.current.find((item) => item.id === id);
    if (!reminder) return null;
    const completedAt = new Date().toISOString();
    const nextDueDate = getNextRecurrenceDate(reminder);
    const updatedReminder = normalizeReminderData(nextDueDate ? { ...reminder, dueDate: nextDueDate, status: 'pending', completedAt: '', lastCompletedAt: completedAt, updatedAt: completedAt, syncStatus: 'pending', syncError: '' } : { ...reminder, status: 'done', completedAt, updatedAt: completedAt, syncStatus: 'pending', syncError: '' });
    setReminders((current) => current.map((item) => item.id === id ? updatedReminder : item));
    enqueueSyncOperation(createOperation('update', 'reminder', { id, data: updatedReminder, lastKnownUpdatedAt: reminder.updatedAt || '' }));
    return { ...updatedReminder, nextDueDate, text: reminder.text };
  }

  function updateReminder(id, changes) {
    const reminder = remindersRef.current.find((item) => item.id === id);
    if (!reminder) return null;
    const updatedReminder = normalizeReminderData({ ...reminder, ...changes, updatedAt: new Date().toISOString(), syncStatus: 'pending', syncError: '' });
    setNotice('Recordatorio actualizado local');
    setReminders((current) => current.map((item) => item.id === id ? updatedReminder : item));
    enqueueSyncOperation(createOperation('update', 'reminder', { id, data: updatedReminder, lastKnownUpdatedAt: reminder.updatedAt || '' }));
    return updatedReminder;
  }

  function deleteReminder(id) {
    const reminder = remindersRef.current.find((item) => item.id === id);
    if (!reminder || !window.confirm(`¿Seguro que deseas borrar la tarea “${reminder.text}”?`)) return null;
    setReminders((current) => current.filter((item) => item.id !== id));
    enqueueSyncOperation(createOperation('delete', 'reminder', { id, lastKnownUpdatedAt: reminder.updatedAt || '' }));
    setNotice('Recordatorio borrado local');
    return reminder;
  }

  const hasAnyData = mile.length > 0 || rafa.length > 0 || Object.values(dynamicMovements).some((rows) => rows.length > 0) || reminders.length > 0;

  return (
    <main className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? 'menu-open' : ''}`}>
        <div className="sidebar-head">
          <div className="brand"><span>GM</span><div><strong>Control Gastos</strong><small>Milena · Fase 4D</small></div></div>
          <button type="button" className="mobile-menu-toggle" onClick={() => setMobileMenuOpen((current) => !current)} aria-expanded={mobileMenuOpen} aria-label="Abrir menú de navegación"><span /> <span /> <span /></button>
        </div>
        <nav className={mobileMenuOpen ? 'open' : ''}>{navItems.map((item) => <button key={item.id} className={active === item.id ? 'active' : ''} type="button" onClick={() => { setActive(item.id); setMobileMenuOpen(false); }}>{item.label}</button>)}</nav>
      </aside>

      <section className="content">
        <header className="topbar"><div><p className="eyebrow">Aplicación personal</p><h1>Control de gastos de Milena</h1></div><span className="version" title={APP_VERSION}>Fase 4D</span></header>
        <StatusBar demoMode={demoMode} loading={loading} error={error} notice={notice} cachedAt={cachedAt} hasData={hasAnyData} onRefresh={loadData} pendingSyncCount={pendingSyncCount} failedSyncCount={failedSyncCount} syncing={syncing} onSyncNow={() => processSyncQueue(true)} onDiagnostic={openDiagnosticPanel} diagnosticLoading={diagnosticLoading} connectionGuard={connectionGuard} />
        <ConnectionGuardNotice guard={connectionGuard} onDiagnostic={openDiagnosticPanel} />
        {loading && !hasAnyData ? <div className="panel loading">Cargando información...</div> : null}
        {active === 'dashboard' && (!loading || hasAnyData) ? <DynamicDashboard accounts={accounts} rowsByAccount={rowsByAccount} month={month} setMonth={setMonth} /> : null}
        {activeAccount && (!loading || hasAnyData) ? <AccountModule account={activeAccount} rows={rowsByAccount[activeAccount.id] || []} config={config} saving={saving} onCreate={(data) => saveAccountMovement(activeAccount, data)} onEdit={(row) => setEditingContext({ account: activeAccount, row })} onDelete={(row) => deleteAccountMovement(activeAccount, row)} /> : null}
        {active === 'pendientes' && (!loading || hasAnyData) ? <PendientesModule reminders={reminders} onUpdate={updateReminder} onComplete={completeReminder} onDelete={deleteReminder} /> : null}
        {active === 'config' && (!loading || hasAnyData) ? <DynamicConfigPanel config={config} accounts={accounts} busy={configBusy} onCreateAccount={createAccount} onUpdateAccount={updateAccount} onDeactivateAccount={deactivateAccount} /> : null}
      </section>

      <AccountEditModal context={editingContext} config={config} saving={saving} onSubmit={(data) => editingContext && saveAccountMovement(editingContext.account, data)} onClose={() => setEditingContext(null)} />
      <DiagnosticPanel open={diagnosticOpen} loading={diagnosticLoading} result={diagnosticResult} onClose={() => setDiagnosticOpen(false)} />
      <ReminderAssistant onCreate={createReminder} />
    </main>
  );
}
