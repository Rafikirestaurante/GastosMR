import { useEffect, useMemo, useState } from 'react';
import { getCachedRemoteSnapshot, sheetsRequest } from './api/sheetsApi.js';
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

const APP_VERSION = 'Fase 2G';

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
  return parseAmount(row.ingreso);
}

function getEgreso(row) {
  return parseAmount(row.egreso);
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

function StatusBar({ demoMode, loading, error, notice, cachedAt, hasData, onRefresh }) {
  let connectionBanner = null;

  if (loading) {
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
        <button className="icon-button" type="button" onClick={reloadApp} title="Recargar app" aria-label="Recargar app">
          ↻
        </button>
      </div>
    </div>
  );
}

const DASHBOARD_TABLE_COLUMNS = [
  { key: 'fecha', label: 'Gastos Fecha' },
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
  return toDateKey(row.fecha);
}

function compareOfficialRowsAsc(a, b) {
  const dateCompare = getRowDateKey(a).localeCompare(getRowDateKey(b));
  if (dateCompare !== 0) return dateCompare;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function Dashboard({ mile, rafa, month, setMonth }) {
  const initialRange = getMonthBounds(month);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(initialRange.from);
  const [rangeTo, setRangeTo] = useState(initialRange.to);
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_DASHBOARD_COLUMNS);

  const monthRows = mile.filter((row) => getMonthKey(row.fecha) === month);
  const totalIngresos = sumBy(monthRows, getIngreso);
  const totalEgresos = sumBy(monthRows, getEgreso);
  const saldoMes = totalIngresos - totalEgresos;
  const saldoAcumulado = mile.reduce((total, row) => total + getIngreso(row) - getEgreso(row), 0);
  const rafaMes = sumBy(
    rafa.filter((row) => getMonthKey(row.fecha) === month),
    (row) => row.monto
  );

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
    if (columnKey === 'fecha') return row.fecha || '-';
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
        <Card title="Saldo del mes" value={money(saldoMes)} />
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
                    className={column.key === 'ingreso' ? 'income-cell' : column.key === 'egreso' ? 'expense-cell' : column.key === 'saldoAcumulado' ? 'balance-cell' : ''}
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
                <td className="row-actions">
                  <button className="small" type="button" onClick={() => onEdit(row)}>Editar</button>
                  <button className="small danger-button" type="button" onClick={() => onDelete(row)}>Borrar</button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr><td colSpan="9" className="empty">No hay registros con esos filtros.</td></tr>
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

export default function App() {
  const [active, setActive] = useState('dashboard');
  const [month, setMonth] = useState(currentMonthKey());
  const [config, setConfig] = useState({ categorias: [], tiposMovimiento: [], subcategorias: [] });
  const [mile, setMile] = useState([]);
  const [rafa, setRafa] = useState([]);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cachedAt, setCachedAt] = useState('');
  const [editing, setEditing] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      setCachedAt('');
      const response = await sheetsRequest('bootstrap');
      setConfig(response.data.config);
      setMile(response.data.mile || []);
      setRafa(response.data.rafa || []);
      setDemoMode(Boolean(response.demo));
    } catch (err) {
      const cached = getCachedRemoteSnapshot();
      if (cached?.data) {
        setConfig(cached.data.config || { categorias: [], tiposMovimiento: [], subcategorias: [] });
        setMile(cached.data.mile || []);
        setRafa(cached.data.rafa || []);
        setDemoMode(false);
        setCachedAt(cached.savedAt || 'copia local');
      }
      setError(err.message || 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function saveMile(data) {
    try {
      setSaving(true);
      setError('');
      setNotice('');
      if (editing) {
        await sheetsRequest('update', { entity: 'mile', id: editing.id, data });
        setNotice('Movimiento actualizado correctamente.');
      } else {
        await sheetsRequest('create', { entity: 'mile', data });
        setNotice('Movimiento guardado correctamente.');
      }
      setEditing(null);
      await loadData();
      setActive('historial');
    } catch (err) {
      setError(err.message || 'No se pudo guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  async function createRafa(data) {
    try {
      setSaving(true);
      setError('');
      await sheetsRequest('create', { entity: 'rafa', data });
      setNotice('Gasto de Rafa guardado correctamente.');
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo guardar el gasto de Rafa.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(entity, row) {
    const label = entity === 'rafa' ? 'este gasto de Rafa' : 'este movimiento de la Tabla Oficial';
    const confirmDelete = window.confirm(`¿Seguro que deseas borrar ${label}? Esta acción no se puede deshacer.`);
    if (!confirmDelete) return;
    try {
      setSaving(true);
      setError('');
      await sheetsRequest('delete', { entity, id: row.id });
      setNotice('Registro borrado correctamente.');
      await loadData();
    } catch (err) {
      setError(err.message || 'No se pudo borrar el registro.');
    } finally {
      setSaving(false);
    }
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
            <small>Milena · Fase 2G</small>
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
          <span className="version" title={APP_VERSION}>Fase 2G</span>
        </header>

        <StatusBar
          demoMode={demoMode}
          loading={loading}
          error={error}
          notice={notice}
          cachedAt={cachedAt}
          hasData={mile.length > 0 || rafa.length > 0}
          onRefresh={loadData}
        />

        {loading ? <div className="panel loading">Cargando información...</div> : null}

        {!loading && active === 'dashboard' ? (
          <Dashboard mile={mile} rafa={rafa} month={month} setMonth={setMonth} />
        ) : null}

        {!loading && active === 'nuevo' ? (
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

        {!loading && active === 'historial' ? (
          <History
            rows={mile}
            config={config}
            onEdit={startEdit}
            onDelete={(row) => deleteRow('mile', row)}
          />
        ) : null}

        {!loading && active === 'rafa' ? (
          <RafaModule
            rows={rafa}
            config={config}
            saving={saving}
            onCreate={createRafa}
            onDelete={(row) => deleteRow('rafa', row)}
          />
        ) : null}

        {!loading && active === 'config' ? <ConfigPanel config={config} /> : null}
      </section>
    </main>
  );
}
