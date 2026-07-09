import { useEffect, useMemo, useRef, useState } from 'react';
import { getCachedRemoteSnapshot, sheetsRequest } from './api/sheetsApi.js';
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

const APP_VERSION = 'Fase 2L';
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

function StatusBar({ demoMode, loading, error, notice, cachedAt, hasData, onRefresh, pendingSyncCount, failedSyncCount, syncing, onSyncNow }) {
  let connectionBanner = null;

  if (loading && hasData && cachedAt) {
    connectionBanner = <div className="banner info">Mostrando la última copia guardada mientras se actualiza Google Sheets...</div>;
  } else if (loading) {
    connectionBanner = <div className="banner info">Verificando conexión con Google Sheets...</div>;
  } else if (error && cachedAt) {
    connectionBanner = (
      <div className="banner warning">
        No se pudo actualizar desde Google Sheets. Se muestra la última información guardada en este dispositivo.
      </div>
    );
  } else if (error) {
    connectionBanner = <div className="banner danger">{error}</div>;
  } else if (demoMode) {
    connectionBanner = (
      <div className="banner warning">
        Modo demo/local activo. Configura la URL de Apps Script y el token para trabajar con Google Sheets.
      </div>
    );
  } else {
    connectionBanner = <div className="banner success">Conectado correctamente a Google Sheets.</div>;
  }

  return (
    <div className="status-wrap">
      {connectionBanner}
      {notice && !error ? <div className="banner success">{notice}</div> : null}
      {pendingSyncCount > 0 ? (
        <div className={`banner ${failedSyncCount > 0 ? 'danger' : syncing ? 'info' : 'warning'}`}>
          {syncing
            ? `Sincronizando ${pendingSyncCount} cambio(s) pendiente(s) con Google Sheets...`
            : failedSyncCount > 0
              ? `${failedSyncCount} cambio(s) no se pudieron sincronizar. Puedes tocar “Sincronizar ahora”.`
              : `${pendingSyncCount} cambio(s) guardado(s) en este dispositivo y pendiente(s) por subir a Google Sheets.`}
        </div>
      ) : null}
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
        {pendingSyncCount > 0 ? (
          <button className="secondary sync-now-button" type="button" onClick={onSyncNow} disabled={syncing}>
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

  return {
    config: safeConfig,
    mile: mileRows,
    rafa: rafaRows
  };
}

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [month, setMonth] = useState(currentMonthKey());
  const [config, setConfig] = useState({ categorias: [], tiposMovimiento: [], subcategorias: [] });
  const [mile, setMile] = useState([]);
  const [rafa, setRafa] = useState([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cachedAt, setCachedAt] = useState('');
  const [editing, setEditing] = useState(null);
  const [syncQueue, setSyncQueueState] = useState(() => getSyncQueue());
  const [syncing, setSyncing] = useState(false);

  const mileRef = useRef(mile);
  const rafaRef = useRef(rafa);
  const configRef = useRef(config);
  const queueRef = useRef(syncQueue);
  const idMapRef = useRef(getIdMap());
  const syncTimerRef = useRef(null);
  const syncingRef = useRef(false);

  const pendingSyncCount = syncQueue.filter((item) => item.status !== 'done').length;
  const failedSyncCount = syncQueue.filter((item) => item.status === 'failed').length;

  useEffect(() => { mileRef.current = mile; }, [mile]);
  useEffect(() => { rafaRef.current = rafa; }, [rafa]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { queueRef.current = syncQueue; }, [syncQueue]);

  useEffect(() => {
    if (config.categorias.length || config.tiposMovimiento.length || config.subcategorias.length || mile.length || rafa.length) {
      saveWorkingSnapshot({ config, mile, rafa });
    }
  }, [config, mile, rafa]);

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
      return;
    }

    setConfig(normalized.config);
    setMile(normalized.mile);
    setRafa(normalized.rafa);
  }

  async function loadData(options = {}) {
    const { silent = false, preferCache = true } = options;
    const working = getWorkingSnapshot();
    const cached = getCachedRemoteSnapshot();
    const hasLocalData = mileRef.current.length > 0 || rafaRef.current.length > 0;

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
          setNotice('Cambios sincronizados correctamente.');
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
    loadData();
    if (queueRef.current.length > 0) scheduleSync(1200);

    const onOnline = () => processSyncQueue(true);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  function saveMile(data) {
    setError('');
    setNotice('Movimiento guardado en este dispositivo. Sincronizando con Google Sheets...');

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
    setNotice('Gasto de Rafa guardado en este dispositivo. Sincronizando con Google Sheets...');
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
    setNotice('Registro borrado en este dispositivo. Sincronizando con Google Sheets...');

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
            <small>Milena · Fase 2L</small>
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
          <span className="version" title={APP_VERSION}>Fase 2L</span>
        </header>

        <StatusBar
          demoMode={demoMode}
          loading={loading}
          error={error}
          notice={notice}
          cachedAt={cachedAt}
          hasData={mile.length > 0 || rafa.length > 0}
          onRefresh={loadData}
          pendingSyncCount={pendingSyncCount}
          failedSyncCount={failedSyncCount}
          syncing={syncing}
          onSyncNow={() => processSyncQueue(true)}
        />

        {loading && mile.length === 0 && rafa.length === 0 ? <div className="panel loading">Cargando información...</div> : null}

        {(active === 'dashboard' && (!loading || mile.length > 0 || rafa.length > 0)) ? (
          <Dashboard mile={mile} rafa={rafa} month={month} setMonth={setMonth} />
        ) : null}

        {(active === 'nuevo' && (!loading || mile.length > 0 || rafa.length > 0)) ? (
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

        {(active === 'historial' && (!loading || mile.length > 0 || rafa.length > 0)) ? (
          <History
            rows={mile}
            config={config}
            onEdit={startEdit}
            onDelete={(row) => deleteRow('mile', row)}
          />
        ) : null}

        {(active === 'rafa' && (!loading || mile.length > 0 || rafa.length > 0)) ? (
          <RafaModule
            rows={rafa}
            config={config}
            saving={saving}
            onCreate={createRafa}
            onDelete={(row) => deleteRow('rafa', row)}
          />
        ) : null}

        {(active === 'config' && (!loading || mile.length > 0 || rafa.length > 0)) ? <ConfigPanel config={config} /> : null}
      </section>
    </main>
  );
}
