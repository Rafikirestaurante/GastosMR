import { useEffect, useMemo, useState } from 'react';
import { sheetsRequest } from './api/sheetsApi.js';
import {
  currentMonthKey,
  getMonthKey,
  money,
  movementSign,
  normalizeText,
  sumBy,
  todayISO
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


const mileTableColumns = [
  { id: 'id', label: 'ID' },
  { id: 'fecha', label: 'Fecha' },
  { id: 'proveedor', label: 'Proveedor' },
  { id: 'concepto', label: 'Concepto' },
  { id: 'tipoMovimiento', label: 'Tipo' },
  { id: 'monto', label: 'Monto' },
  { id: 'categoria', label: 'Categoría' },
  { id: 'subcategoria', label: 'Subcategoría' },
  { id: 'saldoAcumulado', label: 'Saldo acumulado' }
];

function firstDayOfMonth(monthKey = currentMonthKey()) {
  return `${monthKey}-01`;
}

function sortMileAsc(a, b) {
  return String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id));
}

function sortMileDesc(a, b) {
  return String(b.fecha).localeCompare(String(a.fecha)) || String(b.id).localeCompare(String(a.id));
}

function rowsWithRunningBalance(rows) {
  let balance = 0;
  return [...rows].sort(sortMileAsc).map((row) => {
    balance += movementSign(row.tipoMovimiento) * Number(row.monto || 0);
    return { ...row, saldoAcumulado: balance };
  });
}

function renderMileCell(row, columnId) {
  if (columnId === 'tipoMovimiento') {
    return <span className={`pill ${normalizeText(row.tipoMovimiento)}`}>{row.tipoMovimiento}</span>;
  }
  if (columnId === 'monto') {
    const isIncome = normalizeText(row.tipoMovimiento) === 'ingreso';
    return <em className={isIncome ? 'income' : 'expense'}>{isIncome ? '+' : '-'}{money(row.monto)}</em>;
  }
  if (columnId === 'saldoAcumulado') {
    return <em className={Number(row.saldoAcumulado) >= 0 ? 'income' : 'expense'}>{money(row.saldoAcumulado)}</em>;
  }
  return row[columnId] || '—';
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'nuevo', label: 'Nuevo Milena' },
  { id: 'historial', label: 'Historial Milena' },
  { id: 'rafa', label: 'Gastos Rafa' },
  { id: 'config', label: 'Configuración' }
];

function requireFields(data, fields) {
  const missing = fields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length > 0) {
    return `Faltan campos obligatorios: ${missing.join(', ')}.`;
  }
  if (Number(data.monto) <= 0) return 'El monto debe ser mayor que cero.';
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

function StatusBar({ demoMode, loading, error, notice, onRefresh }) {
  return (
    <div className="status-wrap">
      {demoMode ? (
        <div className="banner warning">
          Estás en modo demo/local porque todavía no configuraste la URL de Apps Script en el archivo .env.
        </div>
      ) : (
        <div className="banner success">Conectado a Google Sheets mediante Apps Script.</div>
      )}
      {error ? <div className="banner danger">{error}</div> : null}
      {notice ? <div className="banner success">{notice}</div> : null}
      <button className="secondary" type="button" onClick={onRefresh} disabled={loading}>
        {loading ? 'Actualizando...' : 'Actualizar datos'}
      </button>
    </div>
  );
}

function Dashboard({ mile, rafa, month, setMonth }) {
  const [showRangeTable, setShowRangeTable] = useState(false);
  const [rangeFrom, setRangeFrom] = useState(firstDayOfMonth(month));
  const [rangeTo, setRangeTo] = useState(todayISO());
  const [visibleColumns, setVisibleColumns] = useState(() =>
    Object.fromEntries(mileTableColumns.map((column) => [column.id, true]))
  );

  const monthRows = mile.filter((row) => getMonthKey(row.fecha) === month);
  const totalIngresos = sumBy(
    monthRows.filter((row) => normalizeText(row.tipoMovimiento) === 'ingreso'),
    (row) => row.monto
  );
  const totalEgresos = sumBy(
    monthRows.filter((row) => normalizeText(row.tipoMovimiento) === 'egreso'),
    (row) => row.monto
  );
  const saldoMes = totalIngresos - totalEgresos;
  const saldoAcumulado = mile.reduce(
    (total, row) => total + movementSign(row.tipoMovimiento) * Number(row.monto || 0),
    0
  );
  const rafaMes = sumBy(
    rafa.filter((row) => getMonthKey(row.fecha) === month),
    (row) => row.monto
  );

  const rowsBalance = useMemo(() => rowsWithRunningBalance(mile), [mile]);
  const rangeRows = useMemo(() => rowsBalance
    .filter((row) => {
      const matchesFrom = !rangeFrom || row.fecha >= rangeFrom;
      const matchesTo = !rangeTo || row.fecha <= rangeTo;
      return matchesFrom && matchesTo;
    })
    .sort(sortMileDesc), [rowsBalance, rangeFrom, rangeTo]);

  const visibleColumnList = mileTableColumns.filter((column) => visibleColumns[column.id]);
  const rangeIngresos = sumBy(
    rangeRows.filter((row) => normalizeText(row.tipoMovimiento) === 'ingreso'),
    (row) => row.monto
  );
  const rangeEgresos = sumBy(
    rangeRows.filter((row) => normalizeText(row.tipoMovimiento) === 'egreso'),
    (row) => row.monto
  );
  const rangeSaldo = rangeIngresos - rangeEgresos;
  const ultimoSaldoVisible = rangeRows.length ? rangeRows[0].saldoAcumulado : saldoAcumulado;

  const byCategory = Object.entries(
    monthRows.reduce((acc, row) => {
      if (normalizeText(row.tipoMovimiento) !== 'egreso') return acc;
      const key = row.categoria || 'Sin categoría';
      acc[key] = (acc[key] || 0) + Number(row.monto || 0);
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const lastRows = [...mile]
    .sort(sortMileDesc)
    .slice(0, 6);

  function updateColumn(columnId) {
    setVisibleColumns((current) => ({ ...current, [columnId]: !current[columnId] }));
  }

  function showAllColumns() {
    setVisibleColumns(Object.fromEntries(mileTableColumns.map((column) => [column.id, true])));
  }

  function applySelectedMonth() {
    setRangeFrom(firstDayOfMonth(month));
    setRangeTo(`${month}-31`);
    setShowRangeTable(true);
  }

  function applyCurrentMonth() {
    const currentMonth = currentMonthKey();
    setMonth(currentMonth);
    setRangeFrom(firstDayOfMonth(currentMonth));
    setRangeTo(todayISO());
    setShowRangeTable(true);
  }

  function clearRange() {
    setRangeFrom('');
    setRangeTo('');
    setShowRangeTable(true);
  }

  return (
    <section className="panel">
      <div className="panel-head dashboard-head">
        <div>
          <p className="eyebrow">Resumen principal</p>
          <h2>Dashboard de Milena</h2>
        </div>
        <div className="dashboard-actions">
          <label className="month-picker">
            Mes
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button className="secondary" type="button" onClick={() => setShowRangeTable((current) => !current)}>
            {showRangeTable ? 'Ocultar tabla por rango' : 'Seleccionar rango de fechas'}
          </button>
        </div>
      </div>

      <div className="cards-grid">
        <Card title="Ingresos del mes" value={money(totalIngresos)} />
        <Card title="Egresos del mes" value={money(totalEgresos)} />
        <Card title="Saldo del mes" value={money(saldoMes)} />
        <Card title="Saldo acumulado" value={money(saldoAcumulado)} detail="Ingresos - egresos registrados" />
        <Card title="Gastos Rafa del mes" value={money(rafaMes)} detail="Módulo secundario" />
      </div>

      {showRangeTable ? (
        <article className="subpanel range-table-panel">
          <div className="range-head">
            <div>
              <h3>Tabla principal por rango</h3>
              <p className="muted">Incluye la nueva columna de saldo acumulado calculado sobre todos los movimientos anteriores.</p>
            </div>
            <strong>{rangeRows.length} registros</strong>
          </div>

          <div className="range-tools">
            <label>
              Desde
              <input type="date" value={rangeFrom} onChange={(event) => setRangeFrom(event.target.value)} />
            </label>
            <label>
              Hasta
              <input type="date" value={rangeTo} onChange={(event) => setRangeTo(event.target.value)} />
            </label>
            <button className="secondary" type="button" onClick={applySelectedMonth}>Usar mes seleccionado</button>
            <button className="secondary" type="button" onClick={applyCurrentMonth}>Mes actual</button>
            <button className="secondary" type="button" onClick={clearRange}>Ver todo</button>
          </div>

          <div className="range-summary">
            <Card title="Ingresos del rango" value={money(rangeIngresos)} />
            <Card title="Egresos del rango" value={money(rangeEgresos)} />
            <Card title="Saldo del rango" value={money(rangeSaldo)} />
            <Card title="Último saldo visible" value={money(ultimoSaldoVisible)} detail="Saldo acumulado real" />
          </div>

          <div className="column-controls">
            <div className="column-controls-head">
              <strong>Columnas visibles</strong>
              <button className="small secondary" type="button" onClick={showAllColumns}>Mostrar todas</button>
            </div>
            <div className="column-checks">
              {mileTableColumns.map((column) => (
                <label className="check-pill" key={column.id}>
                  <input
                    type="checkbox"
                    checked={Boolean(visibleColumns[column.id])}
                    onChange={() => updateColumn(column.id)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>

          <div className="mobile-records dashboard-range-mobile" aria-label="Tabla principal por rango en tarjetas">
            {rangeRows.map((row) => (
              <article className="mobile-record" key={`dashboard-mobile-${row.id}`}>
                <div className="mobile-record-head">
                  <div>
                    <strong>{visibleColumns.concepto ? row.concepto : row.id}</strong>
                    <span>{visibleColumns.fecha ? row.fecha : row.id} · {row.id}</span>
                  </div>
                  {visibleColumns.saldoAcumulado ? (
                    <em className={Number(row.saldoAcumulado) >= 0 ? 'income' : 'expense'}>{money(row.saldoAcumulado)}</em>
                  ) : null}
                </div>
                <div className="mobile-record-meta">
                  {visibleColumns.proveedor ? <span><b>Proveedor:</b> {row.proveedor}</span> : null}
                  {visibleColumns.tipoMovimiento ? <span><b>Tipo:</b> {row.tipoMovimiento}</span> : null}
                  {visibleColumns.monto ? <span><b>Monto:</b> {renderMileCell(row, 'monto')}</span> : null}
                  {visibleColumns.categoria ? <span><b>Categoría:</b> {row.categoria}</span> : null}
                  {visibleColumns.subcategoria ? <span><b>Subcategoría:</b> {row.subcategoria}</span> : null}
                </div>
              </article>
            ))}
            {rangeRows.length === 0 ? <div className="empty mobile-empty">No hay registros en ese rango.</div> : null}
          </div>

          <div className="table-wrap desktop-table range-table-wrap">
            <table>
              <thead>
                <tr>
                  {visibleColumnList.map((column) => <th key={column.id}>{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rangeRows.map((row) => (
                  <tr key={`dashboard-${row.id}`}>
                    {visibleColumnList.map((column) => <td key={`${row.id}-${column.id}`}>{renderMileCell(row, column.id)}</td>)}
                  </tr>
                ))}
                {rangeRows.length === 0 ? (
                  <tr><td colSpan={Math.max(visibleColumnList.length, 1)} className="empty">No hay registros en ese rango.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}

      <div className="two-col">
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
                  <span>{row.fecha} · {row.categoria}</span>
                </div>
                <em className={normalizeText(row.tipoMovimiento) === 'ingreso' ? 'income' : 'expense'}>
                  {normalizeText(row.tipoMovimiento) === 'ingreso' ? '+' : '-'}{money(row.monto)}
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
      'monto',
      'categoria',
      'subcategoria'
    ]);
    if (error) {
      setLocalError(error);
      return;
    }
    onSubmit({ ...form, monto: Number(form.monto) });
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
        Categoría <span>*</span>
        <select value={form.categoria} onChange={(event) => update('categoria', event.target.value)}>
          <option value="">Seleccionar</option>
          {config.categorias.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>

      <label>
        Subcategoría <span>*</span>
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
        const matchesType = !type || row.tipoMovimiento === type;
        const matchesCategory = !category || row.categoria === category;
        const matchesFrom = !from || row.fecha >= from;
        const matchesTo = !to || row.fecha <= to;
        return matchesQuery && matchesType && matchesCategory && matchesFrom && matchesTo;
      })
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || String(b.id).localeCompare(String(a.id)));
  }, [rows, query, type, category, from, to]);

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Consulta principal</p>
          <h2>Historial Milena</h2>
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

      <div className="mobile-records" aria-label="Historial Milena en tarjetas">
        {filtered.map((row) => (
          <article className="mobile-record" key={`mobile-${row.id}`}>
            <div className="mobile-record-head">
              <div>
                <strong>{row.concepto}</strong>
                <span>{row.fecha} · {row.id}</span>
              </div>
              <em className={normalizeText(row.tipoMovimiento) === 'ingreso' ? 'income' : 'expense'}>
                {normalizeText(row.tipoMovimiento) === 'ingreso' ? '+' : '-'}{money(row.monto)}
              </em>
            </div>
            <div className="mobile-record-meta">
              <span><b>Proveedor:</b> {row.proveedor}</span>
              <span><b>Tipo:</b> {row.tipoMovimiento}</span>
              <span><b>Categoría:</b> {row.categoria}</span>
              <span><b>Subcategoría:</b> {row.subcategoria}</span>
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
              <th>Tipo</th>
              <th>Monto</th>
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
                <td><span className={`pill ${normalizeText(row.tipoMovimiento)}`}>{row.tipoMovimiento}</span></td>
                <td>{money(row.monto)}</td>
                <td>{row.categoria}</td>
                <td>{row.subcategoria}</td>
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
    onCreate({ ...form, monto: Number(form.monto) });
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
          Categoría <span>*</span>
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
        Estas listas se administran directamente desde la pestaña Configuracion de Google Sheets.
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
  const [editing, setEditing] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError('');
      const response = await sheetsRequest('bootstrap');
      setConfig(response.data.config);
      setMile(response.data.mile || []);
      setRafa(response.data.rafa || []);
      setDemoMode(Boolean(response.demo));
    } catch (err) {
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
    const label = entity === 'rafa' ? 'este gasto de Rafa' : 'este movimiento de Milena';
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
            <small>Milena · Fase 2A</small>
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
              {item.label}
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
          <span className="version">Fase 2A</span>
        </header>

        <StatusBar
          demoMode={demoMode}
          loading={loading}
          error={error}
          notice={notice}
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
                <p className="eyebrow">Formulario obligatorio</p>
                <h2>{editing ? `Editando ${editing.id}` : 'Nuevo movimiento Milena'}</h2>
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
