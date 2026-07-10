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

const APP_VERSION = 'Fase 3F · Configuración persistente';
const SYNC_DELAY_MS = 2500;

function reloadApp() {
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', short: 'Inicio' },
  { id: 'nuevo', label: 'Nuevo registro', short: 'Nuevo' },
  { id: 'historial', label: 'Tabla Oficial', short: 'Historial' },
  { id: 'rafa', label: 'Gastos Rafa', short: 'Rafa' },
  { id: 'config', label: 'Configuración', short: 'Config' }
];


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
            <p className="eyebrow">Fase 3F</p>
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
              <DiagnosticRow label="Tabla Oficial" value={readDiagnosticPath(result, 'spreadsheet.tablaOficialSheet', false) ? 'Existe' : 'No encontrada'} danger={!readDiagnosticPath(result, 'spreadsheet.tablaOficialSheet', false)} />
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

function ReminderAssistant({ reminders, onCreate, onComplete, onDelete, syncing }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hola, soy el asistente de recordatorios. Puedes escribirme: “Recordar pagar arriendo mañana en la tarde”, “Recordar llamar al proveedor 15/07/26” o “Recordar revisar pagos cada mes”. Ahora también se sincronizan con Google Sheets.'
    }
  ]);
  const listRef = useRef(null);

  useEffect(() => {
    if (!open || !listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  const pendingReminders = reminders
    .filter((item) => item.status !== 'done' && item.status !== 'deleted')
    .sort((a, b) => `${a.dueDate || '9999-99-99'} ${a.dueTime || '99:99'}`.localeCompare(`${b.dueDate || '9999-99-99'} ${b.dueTime || '99:99'}`) || String(a.createdAt).localeCompare(String(b.createdAt)));
  const doneReminders = reminders
    .filter((item) => item.status === 'done')
    .sort((a, b) => String(b.completedAt || b.createdAt).localeCompare(String(a.completedAt || a.createdAt)))
    .slice(0, 4);
  const todayCount = pendingReminders.filter((item) => item.dueDate === todayISO()).length;
  const pendingRemoteCount = reminders.filter((item) => ['pending', 'syncing', 'failed'].includes(item.syncStatus)).length;

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
        text: `Listo. Guardé el recordatorio: “${newReminder.text}” (${formatReminderDate(newReminder.dueDate, newReminder.dueTime, newReminder.recurrenceLabel)}). Quedó guardado localmente y se sincronizará con Google Sheets.`
      }
    ]);
    setInput('');
  }

  function completeReminder(id) {
    const result = onComplete(id);
    if (!result) return;

    setMessages((current) => [
      ...current,
      {
        id: `bot-done-${Date.now()}`,
        role: 'bot',
        text: result.nextDueDate
          ? `Listo. Completé “${result.text}” y lo dejé programado nuevamente para ${formatReminderDate(result.nextDueDate, result.dueTime, result.recurrenceLabel)}.`
          : `Marcado como completado: “${result.text}”.`
      }
    ]);
  }

  function deleteReminder(id) {
    const deleted = onDelete(id);
    if (deleted) {
      setMessages((current) => [
        ...current,
        { id: `bot-del-${Date.now()}`, role: 'bot', text: `Eliminé el recordatorio: “${deleted.text}”.` }
      ]);
    }
  }

  return (
    <div className={`assistant-widget ${open ? 'open' : ''}`}>
      {open ? (
        <section className="assistant-panel" aria-label="Asistente de recordatorios">
          <header className="assistant-header">
            <div>
              <span>Asistente</span>
              <strong>Recordatorios</strong>
            </div>
            <button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label="Cerrar asistente">×</button>
          </header>

          <div className="assistant-summary">
            <span>{pendingReminders.length} pendiente(s)</span>
            {todayCount > 0 ? <strong>{todayCount} para hoy</strong> : <strong>Sin urgentes</strong>}
            {pendingRemoteCount > 0 ? <small title="Recordatorios pendientes de sincronizar con Google Sheets">{syncing ? 'Sincronizando' : `${pendingRemoteCount} por sincronizar`}</small> : <small>En Sheets</small>}
          </div>

          <div className="assistant-messages" ref={listRef}>
            {messages.map((message) => (
              <p key={message.id} className={`assistant-message ${message.role}`}>{message.text}</p>
            ))}
          </div>

          <form className="assistant-form" onSubmit={sendMessage}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ej: Recordar pagar luz 15/07 en la tarde"
            />
            <button type="submit">Guardar</button>
          </form>

          <div className="assistant-reminders">
            <h3>Pendientes</h3>
            {pendingReminders.length === 0 ? <p className="empty-small">No hay recordatorios pendientes.</p> : null}
            {pendingReminders.slice(0, 6).map((item) => (
              <article key={item.id} className="assistant-reminder-card">
                <div>
                  <strong>{item.text}</strong>
                  <span>{formatReminderDate(item.dueDate, item.dueTime, item.recurrenceLabel)} · <SyncPill row={item} /></span>
                  {item.syncError ? <small className="danger-text">{item.syncError}</small> : null}
                </div>
                <div className="assistant-reminder-actions">
                  <button type="button" onClick={() => completeReminder(item.id)}>✓</button>
                  <button type="button" className="danger-mini" onClick={() => deleteReminder(item.id)}>×</button>
                </div>
              </article>
            ))}

            {doneReminders.length > 0 ? <h3>Completados recientes</h3> : null}
            {doneReminders.map((item) => (
              <article key={item.id} className="assistant-reminder-card done">
                <div>
                  <strong>{item.text}</strong>
                  <span>Completado · <SyncPill row={item} /></span>
                </div>
                <button type="button" className="danger-mini" onClick={() => deleteReminder(item.id)}>×</button>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <button type="button" className="assistant-fab" onClick={() => setOpen((current) => !current)} aria-label="Abrir asistente de recordatorios">
        <span>💬</span>
        {pendingReminders.length > 0 ? <em>{pendingReminders.length}</em> : null}
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

      <div className="column-toggle-panel">
        <strong>Mostrar columnas</strong>
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
      </div>

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

function History({ rows, config, onEdit, onDelete }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return rows
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
  }, [rows, query, type, category, from, to]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Base de datos principal</p>
          <h2>Tabla Oficial</h2>
        </div>
        <strong>{filtered.length} registros</strong>
      </div>

      <div className="filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por concepto, proveedor o ID" />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Tipo: todos</option>
          {config.tiposMovimiento.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Categoría: todas</option>
          {config.categorias.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>

      <div className="mobile-records" aria-label="Tabla Oficial en tarjetas">
        {filtered.map((row) => (
          <article className="mobile-record" key={`mobile-${row.id}`}>
            <div className="mobile-record-head">
              <div>
                <strong>{row.concepto}</strong>
                <span>{row.fecha} · {row.id}</span>
              </div>
              <em className={getIngreso(row) > 0 ? 'income' : 'expense'}>
                {getIngreso(row) > 0 ? '+' : '-'}{money(getMovementAmount(row))}
              </em>
            </div>
            <div className="mobile-record-meta">
              <span><b>Proveedor:</b> {row.proveedor}</span>
              <span><b>Ingreso:</b> {money(getIngreso(row))}</span>
              <span><b>Egreso:</b> {money(getEgreso(row))}</span>
              <span><b>Categoría:</b> {row.categoria || 'Sin categoría'}</span>
              <span><b>Subcategoría:</b> {row.subcategoria || 'Sin subcategoría'}</span>
              <span><b>Sincronización:</b> <SyncPill row={row} /></span>
              {row.syncError ? <span><b>Error:</b> {row.syncError}</span> : null}
            </div>
            <div className="row-actions mobile-actions">
              <button className="small" type="button" onClick={() => onEdit(row)}>Editar</button>
              <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? <div className="empty mobile-empty">No hay registros con esos filtros.</div> : null}
      </div>

      <div className="table-wrap desktop-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Concepto</th>
              <th>Ingreso</th>
              <th>Egreso</th>
              <th>Categoría</th>
              <th>Subcategoría</th>
              <th>Sync</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.fecha}</td>
                <td>{row.proveedor}</td>
                <td>{row.concepto}</td>
                <td className="income-cell">{getIngreso(row) > 0 ? money(getIngreso(row)) : '-'}</td>
                <td className="expense-cell">{getEgreso(row) > 0 ? money(getEgreso(row)) : '-'}</td>
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
    </section>
  );
}

function RafaModule({ rows, config, onCreate, onDelete, saving }) {
  const [form, setForm] = useState(emptyRafa);
  const [error, setError] = useState('');

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
        <strong>Total: {money(sumBy(rows, (row) => row.monto))}</strong>
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

      <div className="mobile-records" aria-label="Gastos Rafa en tarjetas">
        {[...rows].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map((row) => (
          <article className="mobile-record" key={`rafa-mobile-${row.id}`}>
            <div className="mobile-record-head">
              <div>
                <strong>{row.concepto}</strong>
                <span>{row.fecha} · {row.id}</span>
              </div>
              <em className="expense">{money(row.monto)}</em>
            </div>
            <div className="mobile-record-meta">
              <span><b>Categoría:</b> {row.categoria}</span>
              <span><b>Sincronización:</b> <SyncPill row={row} /></span>
              {row.syncError ? <span><b>Error:</b> {row.syncError}</span> : null}
            </div>
            <div className="row-actions mobile-actions">
              <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
            </div>
          </article>
        ))}
        {rows.length === 0 ? <div className="empty mobile-empty">No hay gastos de Rafa registrados.</div> : null}
      </div>

      <div className="table-wrap small-table desktop-table">
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
            {[...rows].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.fecha}</td>
                <td>{row.concepto}</td>
                <td>{money(row.monto)}</td>
                <td>{row.categoria}</td>
                <td><SyncPill row={row} /></td>
                <td><button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
  const mileRows = (data.mile || [])
    .filter((row) => normalizeText(row.estado || 'Activo') !== 'eliminado')
    .map((row) => {
      const ingreso = parseAmount(row.ingreso);
      const egreso = parseAmount(row.egreso);
      const fechaKey = toDateKey(row.fecha);
      return {
        ...row,
        estado: row.estado || 'Activo',
        creadoEn: row.creadoEn || row.creado_en || '',
        actualizadoEn: row.actualizadoEn || row.actualizado_en || '',
        _ingreso: ingreso,
        _egreso: egreso,
        _neto: ingreso - egreso,
        _fechaKey: fechaKey,
        _monthKey: fechaKey ? fechaKey.slice(0, 7) : ''
      };
    });

  const rafaRows = (data.rafa || []).map((row) => {
    const fechaKey = toDateKey(row.fecha);
    return {
      ...row,
      monto: parseAmount(row.monto),
      _fechaKey: fechaKey,
      _monthKey: fechaKey ? fechaKey.slice(0, 7) : ''
    };
  });

  const reminderRows = (data.reminders || [])
    .map(normalizeReminderData)
    .filter((row) => row.text.trim() && row.status !== 'deleted');

  return {
    config: safeConfig,
    mile: mileRows,
    rafa: rafaRows,
    reminders: reminderRows
  };
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [month, setMonth] = useState(currentMonthKey());
  const [config, setConfig] = useState({ categorias: [], tiposMovimiento: [], subcategorias: [] });
  const [mile, setMile] = useState([]);
  const [rafa, setRafa] = useState([]);
  const [reminders, setReminders] = useState(() => readStoredReminders());
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cachedAt, setCachedAt] = useState('');
  const [editing, setEditing] = useState(null);
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
  const remindersRef = useRef(reminders);
  const configRef = useRef(config);
  const queueRef = useRef(syncQueue);
  const idMapRef = useRef(getIdMap());
  const syncTimerRef = useRef(null);
  const syncingRef = useRef(false);
  const connectionGuardRef = useRef(connectionGuard);

  const pendingSyncCount = syncQueue.filter((item) => item.status !== 'done').length;
  const failedSyncCount = syncQueue.filter((item) => item.status === 'failed').length;

  useEffect(() => { mileRef.current = mile; }, [mile]);
  useEffect(() => { rafaRef.current = rafa; }, [rafa]);
  useEffect(() => { remindersRef.current = reminders; }, [reminders]);
  useEffect(() => { saveStoredReminders(reminders); }, [reminders]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { queueRef.current = syncQueue; }, [syncQueue]);
  useEffect(() => { connectionGuardRef.current = connectionGuard; }, [connectionGuard]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (config.categorias.length || config.tiposMovimiento.length || config.subcategorias.length || mile.length || rafa.length || reminders.length) {
      saveWorkingSnapshot({ config, mile, rafa, reminders });
    }
  }, [config, mile, rafa, reminders]);

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

  function applyLoadedData(data, options = {}) {
    const { keepPendingLocal = true } = options;
    const normalized = normalizeLoadedData(data);
    const localSnapshot = getWorkingSnapshot()?.data;
    const localNormalized = localSnapshot ? normalizeLoadedData(localSnapshot) : null;
    const hasPending = queueRef.current.some((item) => item.status !== 'done');

    if (keepPendingLocal && hasPending && localNormalized) {
      const mergeRows = (remoteRows, localRows) => {
        const result = [...remoteRows];
        localRows
          .filter((row) => ['pending', 'syncing', 'failed'].includes(row.syncStatus))
          .forEach((localRow) => {
            const realId = resolveSyncedId(localRow.id, idMapRef.current);
            const existingIndex = result.findIndex((row) => row.id === localRow.id || row.id === realId);
            const rowToKeep = { ...localRow, id: existingIndex >= 0 ? result[existingIndex].id : localRow.id };
            if (existingIndex >= 0) result[existingIndex] = rowToKeep;
            else result.unshift(rowToKeep);
          });
        return result;
      };

      setConfig(normalized.config.categorias.length || normalized.config.tiposMovimiento.length || normalized.config.subcategorias.length
        ? normalized.config
        : localNormalized.config
      );
      setMile(mergeRows(normalized.mile, localNormalized.mile));
      setRafa(mergeRows(normalized.rafa, localNormalized.rafa));
      setReminders(mergeRows(normalized.reminders || [], localNormalized.reminders || []));
      return;
    }

    setConfig(normalized.config);
    setMile(normalized.mile);
    setRafa(normalized.rafa);
    setReminders(normalized.reminders || []);
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
    const hasLocalData = mileRef.current.length > 0 || rafaRef.current.length > 0 || remindersRef.current.length > 0;

    if (!silent) {
      setLoading(true);
      setError('');
      if (preferCache && working?.data && !hasLocalData) {
        applyLoadedData(working.data, { keepPendingLocal: true });
        setDemoMode(false);
        setCachedAt(working.savedAt || 'copia local');
      } else if (preferCache && cached?.data && !hasLocalData) {
        applyLoadedData(cached.data, { keepPendingLocal: true });
        setDemoMode(false);
        setCachedAt(cached.savedAt || 'copia local');
      } else {
        setCachedAt('');
      }
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
          setDemoMode(false);
          setCachedAt(working.savedAt || 'copia local');
        } else if (cached?.data && !hasLocalData) {
          applyLoadedData(cached.data, { keepPendingLocal: true });
          setDemoMode(false);
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
    syncTimerRef.current = window.setTimeout(() => {
      processSyncQueue();
    }, delay);
  }

  function enqueueSyncOperation(operation) {
    updateSyncQueue((current) => [...current, operation]);
    scheduleSync();
  }

  function markRowsByOperation(operation, status, syncError = '') {
    const resolvedId = resolveSyncedId(operation.id, idMapRef.current);
    const updater = (row) => {
      if (row.id !== operation.id && row.id !== resolvedId) return row;
      return {
        ...row,
        syncStatus: status,
        syncError
      };
    };

    if (operation.entity === 'rafa') setRafa((current) => current.map(updater));
    else if (operation.entity === 'reminder') setReminders((current) => current.map(updater));
    else setMile((current) => current.map(updater));
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

    if (!normalizedData) {
      markRowsByOperation(operation, 'synced');
      return;
    }

    if (operation.entity === 'reminder') {
      const normalized = normalizeLoadedData({ reminders: [{ ...normalizedData, syncStatus: 'synced', syncError: '' }] }).reminders[0];
      if (!normalized) return;
      setReminders((current) => current.map((row) => {
        const realId = resolveSyncedId(row.id, idMap);
        return row.id === operation.id || row.id === normalized.id || realId === normalized.id ? normalized : row;
      }));
      return;
    }

    if (operation.entity === 'rafa') {
      const normalized = normalizeLoadedData({ rafa: [{ ...normalizedData, syncStatus: 'synced', syncError: '' }] }).rafa[0];
      setRafa((current) => current.map((row) => {
        const realId = resolveSyncedId(row.id, idMap);
        return row.id === operation.id || row.id === normalized.id || realId === normalized.id ? normalized : row;
      }));
      return;
    }

    const normalized = normalizeLoadedData({ mile: [{ ...normalizedData, syncStatus: 'synced', syncError: '' }] }).mile[0];
    setMile((current) => current.map((row) => {
      const realId = resolveSyncedId(row.id, idMap);
      return row.id === operation.id || row.id === normalized.id || realId === normalized.id ? normalized : row;
    }));
  }

  async function processSyncQueue(force = false) {
    if (syncingRef.current) return;
    const available = queueRef.current.filter((item) => item.status === 'pending' || item.status === 'failed' || item.status === 'syncing');
    if (available.length === 0) return;

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
            : {
                entity: currentItem.entity,
                id: resolvedId,
                data: currentItem.data || undefined,
                lastKnownUpdatedAt: currentItem.lastKnownUpdatedAt || ''
              };

          const response = await sheetsRequest(currentItem.action, payload);
          applySyncedResponse({ ...currentItem, id: resolvedId }, response?.data);
          workingQueue = workingQueue.filter((op) => op.opId !== currentItem.opId);
          setSyncQueue(workingQueue);
          setNotice('Sincronizado');
        } catch (err) {
          const message = err.message || 'No se pudo sincronizar este cambio.';
          workingQueue = workingQueue.map((op) => op.opId === currentItem.opId
            ? {
                ...op,
                status: 'failed',
                attempts: (op.attempts || 0) + 1,
                lastError: message,
                lastTriedAt: new Date().toISOString()
              }
            : op
          );
          setSyncQueue(workingQueue);
          markRowsByOperation(currentItem, 'failed', message);
          setError('Hay cambios pendientes que no pudieron sincronizarse. Toca “Sincronizar ahora” para reintentar.');
          if (!force) break;
        }
      }

      if (workingQueue.length === 0) {
        await loadData({ silent: true, preferCache: false });
      }
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
    } finally {
      setDiagnosticLoading(false);
    }
  }

  function saveMile(data) {
    setError('');
    setNotice('Guardado local');

    if (editing) {
      const updatedSource = { ...editing, ...data, id: editing.id, syncStatus: 'pending', syncError: '' };
      const updated = normalizeLoadedData({ mile: [updatedSource] }).mile[0];
      setMile((current) => current.map((row) => row.id === editing.id ? updated : row));
      enqueueSyncOperation(createOperation('update', 'mile', {
        id: editing.id,
        data,
        lastKnownUpdatedAt: editing.actualizadoEn || ''
      }));
    } else {
      const tempId = createTempId('TO');
      const localCreated = normalizeLoadedData({
        mile: [{
          ...data,
          id: tempId,
          creadoEn: new Date().toISOString().slice(0, 19),
          actualizadoEn: '',
          estado: 'Activo',
          syncStatus: 'pending',
          syncError: ''
        }]
      }).mile[0];
      setMile((current) => [localCreated, ...current]);
      enqueueSyncOperation(createOperation('create', 'mile', {
        id: tempId,
        data
      }));
    }

    setEditing(null);
    setActive('historial');
  }

  function createRafa(data) {
    setError('');
    setNotice('Guardado local');
    const tempId = createTempId('R');
    const localCreated = normalizeLoadedData({
      rafa: [{
        ...data,
        id: tempId,
        syncStatus: 'pending',
        syncError: ''
      }]
    }).rafa[0];

    setRafa((current) => [localCreated, ...current]);
    enqueueSyncOperation(createOperation('create', 'rafa', {
      id: tempId,
      data
    }));
  }

  function deleteRow(entity, row) {
    const label = entity === 'rafa' ? 'este gasto de Rafa' : 'este movimiento de la Tabla Oficial';
    const confirmText = entity === 'rafa'
      ? `¿Seguro que deseas borrar ${label}? Se quitará de la app y luego se sincronizará con Google Sheets.`
      : `¿Seguro que deseas borrar ${label}? Se quitará de la app y luego quedará marcado como Eliminado en Google Sheets.`;
    const confirmDelete = window.confirm(confirmText);
    if (!confirmDelete) return;

    setError('');
    setNotice('Borrado local');

    if (entity === 'rafa') {
      setRafa((current) => current.filter((item) => item.id !== row.id));
    } else {
      setMile((current) => current.filter((item) => item.id !== row.id));
    }

    enqueueSyncOperation(createOperation('delete', entity, {
      id: row.id,
      lastKnownUpdatedAt: row.actualizadoEn || ''
    }));
  }

  function createReminder(parsed) {
    setError('');
    setNotice('Recordatorio guardado local');
    const tempId = createTempId('REM');
    const localReminder = normalizeReminderData({
      id: tempId,
      text: parsed.text,
      dueDate: parsed.dueDate,
      dueTime: parsed.dueTime,
      recurrence: parsed.recurrence,
      recurrenceLabel: parsed.recurrenceLabel,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: '',
      completedAt: '',
      syncStatus: 'pending',
      syncError: ''
    });

    setReminders((current) => [localReminder, ...current]);
    enqueueSyncOperation(createOperation('create', 'reminder', {
      id: tempId,
      data: localReminder
    }));
    return localReminder;
  }

  function completeReminder(id) {
    const reminder = remindersRef.current.find((item) => item.id === id);
    if (!reminder) return null;

    const completedAt = new Date().toISOString();
    const nextDueDate = getNextRecurrenceDate(reminder);
    const updatedReminder = normalizeReminderData(nextDueDate
      ? {
          ...reminder,
          dueDate: nextDueDate,
          status: 'pending',
          completedAt: '',
          lastCompletedAt: completedAt,
          updatedAt: completedAt,
          syncStatus: 'pending',
          syncError: ''
        }
      : {
          ...reminder,
          status: 'done',
          completedAt,
          updatedAt: completedAt,
          syncStatus: 'pending',
          syncError: ''
        }
    );

    setReminders((current) => current.map((item) => item.id === id ? updatedReminder : item));
    enqueueSyncOperation(createOperation('update', 'reminder', {
      id,
      data: updatedReminder,
      lastKnownUpdatedAt: reminder.updatedAt || ''
    }));
    return { ...updatedReminder, nextDueDate, text: reminder.text };
  }

  function deleteReminder(id) {
    const reminder = remindersRef.current.find((item) => item.id === id);
    if (!reminder) return null;

    setError('');
    setNotice('Recordatorio borrado local');
    setReminders((current) => current.filter((item) => item.id !== id));
    enqueueSyncOperation(createOperation('delete', 'reminder', {
      id,
      lastKnownUpdatedAt: reminder.updatedAt || ''
    }));
    return reminder;
  }

  function startEdit(row) {
    setEditing(row);
    setActive('nuevo');
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>GM</span>
          <div>
            <strong>Control Gastos</strong>
            <small>Milena · Fase 3F</small>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={active === item.id ? 'active' : ''}
              type="button"
              onClick={() => setActive(item.id)}
            >
              <span className="nav-label-full">{item.label}</span>
              <span className="nav-label-short">{item.short}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Aplicación personal</p>
            <h1>Control de gastos de Milena</h1>
          </div>
          <span className="version" title={APP_VERSION}>Fase 3F</span>
        </header>

        <StatusBar
          demoMode={demoMode}
          loading={loading}
          error={error}
          notice={notice}
          cachedAt={cachedAt}
          hasData={mile.length > 0 || rafa.length > 0 || reminders.length > 0}
          onRefresh={loadData}
          pendingSyncCount={pendingSyncCount}
          failedSyncCount={failedSyncCount}
          syncing={syncing}
          onSyncNow={() => processSyncQueue(true)}
          onDiagnostic={openDiagnosticPanel}
          diagnosticLoading={diagnosticLoading}
          connectionGuard={connectionGuard}
        />

        <ConnectionGuardNotice guard={connectionGuard} onDiagnostic={openDiagnosticPanel} />

        {loading && mile.length === 0 && rafa.length === 0 && reminders.length === 0 ? <div className="panel loading">Cargando información...</div> : null}

        {(active === 'dashboard' && (!loading || mile.length > 0 || rafa.length > 0 || reminders.length > 0)) ? (
          <Dashboard mile={mile} rafa={rafa} month={month} setMonth={setMonth} />
        ) : null}

        {(active === 'nuevo' && (!loading || mile.length > 0 || rafa.length > 0 || reminders.length > 0)) ? (
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Tabla Oficial</p>
                <h2>{editing ? `Editando ${editing.id}` : 'Nuevo movimiento'}</h2>
              </div>
            </div>
            <MileForm
              config={config}
              initialData={editing || emptyMile}
              editingId={editing?.id}
              saving={saving}
              onSubmit={saveMile}
              onCancel={() => setEditing(null)}
            />
          </section>
        ) : null}

        {(active === 'historial' && (!loading || mile.length > 0 || rafa.length > 0 || reminders.length > 0)) ? (
          <History
            rows={mile}
            config={config}
            onEdit={startEdit}
            onDelete={(row) => deleteRow('mile', row)}
          />
        ) : null}

        {(active === 'rafa' && (!loading || mile.length > 0 || rafa.length > 0 || reminders.length > 0)) ? (
          <RafaModule
            rows={rafa}
            config={config}
            saving={saving}
            onCreate={createRafa}
            onDelete={(row) => deleteRow('rafa', row)}
          />
        ) : null}

        {(active === 'config' && (!loading || mile.length > 0 || rafa.length > 0 || reminders.length > 0)) ? <ConfigPanel config={config} /> : null}
      </section>
      <DiagnosticPanel
        open={diagnosticOpen}
        loading={diagnosticLoading}
        result={diagnosticResult}
        onClose={() => setDiagnosticOpen(false)}
      />
      <ReminderAssistant
        reminders={reminders}
        onCreate={createReminder}
        onComplete={completeReminder}
        onDelete={deleteReminder}
        syncing={syncing}
      />
    </main>
  );
}
