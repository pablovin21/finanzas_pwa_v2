import './style.css';

const DB_NAME = 'finanzasFamiliaresDB';
const DB_VERSION = 1;
const STORE_NAME = 'appState';

let dbPromise;
let vistaActual = 'MES';
let periodoSeleccionado = new Date().toISOString().slice(0, 7);
let simPresupuestos = [];
let simCuentas = [];
let ejercicios = [];
let ejercicioActivoId = null;

const defaultData = {
  cuentas: [
    { id: 1, nombre: 'Cuenta Corriente BBVA', saldoInicial: 2000.00, saldoActual: 2500.00, participacion: 100 },
    { id: 2, nombre: 'Cuenta Compartida Santander', saldoInicial: 1000.00, saldoActual: 1400.00, participacion: 50 }
  ],
  categorias: [
    { id: 1, nombre: 'Nómina', grupo: 'Ingreso' },
    { id: 2, nombre: 'Hipoteca / Alquiler', grupo: 'Gasto del hogar' },
    { id: 3, nombre: 'Supermercado', grupo: 'Gasto del hogar' },
    { id: 4, nombre: 'Suministros (Luz/Agua)', grupo: 'Gasto del hogar' },
    { id: 5, nombre: 'Restauración y Ocio', grupo: 'Gasto en ocio' },
    { id: 6, nombre: 'Viajes y Vacaciones', grupo: 'Gasto en ocio' }
  ],
  presupuestos: [
    { categoria: 'Nómina', importeMovimiento: 3500.00, numMovimientosAnuales: 12 },
    { categoria: 'Hipoteca / Alquiler', importeMovimiento: 700.00, numMovimientosAnuales: 12 },
    { categoria: 'Supermercado', importeMovimiento: 450.00, numMovimientosAnuales: 12 },
    { categoria: 'Suministros (Luz/Agua)', importeMovimiento: 180.00, numMovimientosAnuales: 12 },
    { categoria: 'Restauración y Ocio', importeMovimiento: 300.00, numMovimientosAnuales: 12 }
  ],
  movimientos: [
    { id: 1, concepto: 'Nómina Empresa', importe: 3500.00, participacion: 100, categoria: 'Nómina', fecha: '2026-09-01', cuentaId: 1, esTransferencia: false },
    { id: 2, concepto: 'Cuota Hipoteca', importe: 700.00, participacion: 50, categoria: 'Hipoteca / Alquiler', fecha: '2026-09-02', cuentaId: 2, esTransferencia: false },
    { id: 3, concepto: 'Compra Mercadona', importe: 125.40, participacion: 100, categoria: 'Supermercado', fecha: '2026-09-03', cuentaId: 1, esTransferencia: false },
    { id: 4, concepto: 'Cena Restaurante', importe: 80.00, participacion: 50, categoria: 'Restauración y Ocio', fecha: '2026-09-04', cuentaId: 2, esTransferencia: false }
  ]
};

let cuentas = [...defaultData.cuentas];
let categorias = [...defaultData.categorias];
let presupuestos = [...defaultData.presupuestos];
let movimientos = [...defaultData.movimientos];

document.getElementById('input-fecha').value = new Date().toISOString().split('T')[0];

function openDatabase() {
  if (!('indexedDB' in window)) {
    console.warn('IndexedDB no disponible, se usa memoria en runtime');
    return Promise.resolve(null);
  }

  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

async function saveState() {
  const db = await openDatabase();
  const record = { id: `exercise:${ejercicioActivoId}`, data: { cuentas, categorias, presupuestos, movimientos } };
  if (!db) {
    localStorage.setItem(record.id, JSON.stringify(record.data));
    return;
  }
  await guardarRegistro(db, record);
}

async function loadState() {
  const db = await openDatabase();
  const metaRecord = db ? await leerRegistro(db, 'exercise-meta') : null;
  const storedMeta = metaRecord?.data || JSON.parse(localStorage.getItem('exercise-meta') || 'null');

  if (storedMeta?.ejercicios?.length) {
    ejercicios = storedMeta.ejercicios;
    ejercicioActivoId = storedMeta.activoId;
    if (!ejercicios.some(e => e.id === ejercicioActivoId)) ejercicioActivoId = ejercicios[0].id;
  } else {
    const legacyRecord = db ? await leerRegistro(db, 'state') : null;
    const legacyData = legacyRecord?.data || JSON.parse(localStorage.getItem('exercise:2026') || 'null') || clonarDatos(defaultData);
    ejercicios = [{ id: '2026', nombre: '2026' }];
    ejercicioActivoId = '2026';
    await guardarDatosEjercicio(ejercicioActivoId, legacyData, db);
    await guardarMetaEjercicios(db);
  }

  let exerciseData;
  if (db) exerciseData = (await leerRegistro(db, `exercise:${ejercicioActivoId}`))?.data;
  else exerciseData = JSON.parse(localStorage.getItem(`exercise:${ejercicioActivoId}`) || 'null');
  aplicarDatosEjercicio(exerciseData || defaultData);
}

function clonarDatos(data) {
  return JSON.parse(JSON.stringify(data));
}

function guardarRegistro(db, record) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(record);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function leerRegistro(db, id) {
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function aplicarDatosEjercicio(data) {
  cuentas = Array.isArray(data.cuentas) ? data.cuentas : clonarDatos(defaultData.cuentas);
  categorias = Array.isArray(data.categorias) ? data.categorias : clonarDatos(defaultData.categorias);
  presupuestos = Array.isArray(data.presupuestos) ? data.presupuestos : clonarDatos(defaultData.presupuestos);
  movimientos = Array.isArray(data.movimientos) ? data.movimientos : clonarDatos(defaultData.movimientos);
}

async function guardarDatosEjercicio(id, data, db = null) {
  const record = { id: `exercise:${id}`, data: clonarDatos(data) };
  const database = db || await openDatabase();
  if (database) await guardarRegistro(database, record);
  else localStorage.setItem(record.id, JSON.stringify(record.data));
}

async function guardarMetaEjercicios(db = null) {
  const record = { id: 'exercise-meta', data: { ejercicios, activoId: ejercicioActivoId } };
  const database = db || await openDatabase();
  if (database) await guardarRegistro(database, record);
  else localStorage.setItem(record.id, JSON.stringify(record.data));
}

async function guardarEstadoSimulacion() {
  const data = { presupuestos: simPresupuestos, cuentas: simCuentas };
  const recordId = `simulation:${ejercicioActivoId}`;
  try {
    const db = await openDatabase();
    if (!db) throw new Error('IndexedDB no disponible');
    await guardarRegistro(db, { id: recordId, data });
  } catch (error) {
    console.warn('No se pudo guardar la simulación en IndexedDB', error);
    try {
      localStorage.setItem(recordId, JSON.stringify(data));
    } catch (storageError) {
      console.warn('No se pudo guardar la simulación localmente', storageError);
    }
  }
}

async function cargarEstadoSimulacion() {
  let data;
  const recordId = `simulation:${ejercicioActivoId}`;
  try {
    const db = await openDatabase();
    if (db) {
      data = (await leerRegistro(db, recordId))?.data;
      if (!data && ejercicioActivoId === '2026') data = (await leerRegistro(db, 'simulation'))?.data;
    }
  } catch (error) {
    console.warn('No se pudo cargar la simulación de IndexedDB', error);
  }

  if (!data) {
    try {
      data = JSON.parse(localStorage.getItem(recordId) || localStorage.getItem('finanzasFamiliaresSimulation') || 'null');
    } catch (error) {
      console.warn('No se pudo leer la simulación local', error);
    }
  }

  if (!data || !Array.isArray(data.presupuestos) || !Array.isArray(data.cuentas)) return false;
  simPresupuestos = data.presupuestos.map(p => ({ ...p }));
  simCuentas = data.cuentas.map(c => ({ ...c }));
  return true;
}

function obtenerTipoPorCategoria(nombreCat) {
  const cat = categorias.find(c => c.nombre === nombreCat);
  return cat && cat.grupo === 'Ingreso' ? 'INGRESO' : 'GASTO';
}

function calcularFinanzas() {
  const multEscala = vistaActual === 'ANIO' ? 12 : 1;
  const movimientosPeriodo = movimientos.filter(m => perteneceAlPeriodo(m.fecha));
  const saldoRealPropio = cuentas.reduce((acc, c) => acc + (c.saldoActual * (c.participacion / 100)), 0);
  const ingresosReales = movimientosPeriodo
    .filter(m => !m.esTransferencia && obtenerTipoPorCategoria(m.categoria) === 'INGRESO')
    .reduce((acc, m) => acc + (m.importe * (m.participacion / 100)), 0);
  const gastosReales = movimientosPeriodo
    .filter(m => !m.esTransferencia && obtenerTipoPorCategoria(m.categoria) === 'GASTO')
    .reduce((acc, m) => acc + (m.importe * (m.participacion / 100)), 0);

  let ingresosPendientesTotal = 0;
  let gastosPendientesTotal = 0;
  const desgloseIngresosTotales = {};
  const desgloseIngresosPendientes = {};
  const desgloseGastosReales = {};
  const desgloseGastosPendientes = {};

  categorias.forEach(cat => {
    const pres = presupuestos.find(p => p.categoria === cat.nombre);
    const presMensualBase = pres ? (pres.importeMovimiento * pres.numMovimientosAnuales) / 12 : 0;
    const asignadoEscalado = presMensualBase * multEscala;
    const ejecutadoCat = movimientosPeriodo
      .filter(m => !m.esTransferencia && m.categoria === cat.nombre)
      .reduce((acc, m) => acc + (m.importe * (m.participacion / 100)), 0);

    if (cat.grupo === 'Ingreso') {
      const pendiente = Math.max(0, asignadoEscalado - ejecutadoCat);
      ingresosPendientesTotal += pendiente;
      desgloseIngresosTotales[cat.nombre] = Math.max(asignadoEscalado, ejecutadoCat);
      desgloseIngresosPendientes[cat.nombre] = pendiente;
    } else {
      const pendiente = Math.max(0, asignadoEscalado - ejecutadoCat);
      gastosPendientesTotal += pendiente;
      desgloseGastosReales[cat.nombre] = ejecutadoCat;
      desgloseGastosPendientes[cat.nombre] = pendiente;
    }
  });

  const ingresosTotalesPrevisibles = ingresosReales + ingresosPendientesTotal;
  const gastosTotalesPrevisibles = gastosReales + gastosPendientesTotal;
  const forecast = saldoRealPropio + ingresosPendientesTotal - gastosPendientesTotal;
  const capacidadAhorroImporte = ingresosTotalesPrevisibles - gastosTotalesPrevisibles;
  const capacidadAhorroPct = ingresosTotalesPrevisibles > 0 ? (capacidadAhorroImporte / ingresosTotalesPrevisibles) * 100 : 0;
  const pctGastosReales = ingresosTotalesPrevisibles > 0 ? (gastosReales / ingresosTotalesPrevisibles) * 100 : 0;
  const pctGastosPendientes = ingresosTotalesPrevisibles > 0 ? (gastosPendientesTotal / ingresosTotalesPrevisibles) * 100 : 0;

  setSignedAmount('kpi-forecast', forecast);
  setSignedAmount('kpi-saldo-real', saldoRealPropio);
  setSignedAmount('kpi-ahorro-importe', capacidadAhorroImporte);
  setSignedValue('lbl-kpi-ahorro-pct', `${capacidadAhorroPct.toFixed(1)}%`, capacidadAhorroPct);
  setSignedAmount('resumen-ingresos-totales', ingresosTotalesPrevisibles, '+');
  setSignedAmount('resumen-ingresos-pendientes', ingresosPendientesTotal, '+');
  setSignedAmount('resumen-gastos-reales', gastosReales, '-', true);
  setSignedAmount('resumen-gastos-pendientes', gastosPendientesTotal, '-', true);
  setSignedValue('pct-gastos-reales', `${pctGastosReales.toFixed(1)}% s/ingresos`, pctGastosReales);
  setSignedValue('pct-gastos-pendientes', `${pctGastosPendientes.toFixed(1)}% s/ingresos`, pctGastosPendientes);
  setSignedAmount('analisis-ahorro-importe', capacidadAhorroImporte);
  setSignedValue('analisis-ahorro-pct', `${capacidadAhorroPct.toFixed(1)}%`, capacidadAhorroPct);

  renderAcordeon('det-ingresos-totales', desgloseIngresosTotales, ingresosTotalesPrevisibles, 'text-emerald-700');
  renderAcordeon('det-ingresos-pendientes', desgloseIngresosPendientes, ingresosTotalesPrevisibles, 'text-emerald-600');
  renderAcordeon('det-gastos-reales', desgloseGastosReales, ingresosTotalesPrevisibles, 'text-rose-700', true);
  renderAcordeon('det-gastos-pendientes', desgloseGastosPendientes, ingresosTotalesPrevisibles, 'text-amber-800', true);

  renderCuentas();
  renderMovimientos();
  renderPresupuestos();
  renderConfiguracion();
  actualizarSelectoresCategorias();
  actualizarSelectoresCuentas();
}

function renderAcordeon(containerId, datosObj, totalIngresos, colorTexto, esGasto = false) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  const keys = Object.keys(datosObj);
  if (!keys.length) {
    container.innerHTML = '<p class="text-gray-400 italic">Sin datos</p>';
    return;
  }

  keys.forEach(cat => {
    const monto = datosObj[cat];
    const pctSobreIngresos = totalIngresos > 0 ? (monto / totalIngresos) * 100 : 0;
    container.innerHTML += `
      <div class="flex justify-between items-center py-1 border-b border-gray-200/50 last:border-0">
        <span class="font-medium text-gray-700">${cat}</span>
        <div class="text-right">
          <span class="font-bold ${colorTexto} ${esGasto ? 'amount-negative' : amountClass(monto)} block tabular-amount">${fmt(monto)}</span>
          ${esGasto ? `<span class="text-[9px] ${amountClass(pctSobreIngresos)}">${pctSobreIngresos.toFixed(1)}% s/ingresos</span>` : ''}
        </div>
      </div>
    `;
  });
}

function guardarCuenta() {
  const editId = document.getElementById('edit-cta-id').value;
  const nombre = document.getElementById('cta-input-nombre').value;
  const saldoInicial = Number(document.getElementById('cta-input-inicial').value) || 0;
  const saldoActual = Number(document.getElementById('cta-input-actual').value) || 0;
  const participacion = Number(document.getElementById('cta-input-part').value) || 100;

  if (!nombre) return alert('Introduce un nombre para la cuenta');

  if (editId) {
    const idx = cuentas.findIndex(c => c.id == editId);
    if (idx !== -1) cuentas[idx] = { ...cuentas[idx], nombre, saldoInicial, saldoActual, participacion };
  } else {
    cuentas.push({ id: Date.now(), nombre, saldoInicial, saldoActual, participacion });
  }

  cancelarEdicionCuenta();
  saveState();
  calcularFinanzas();
}

function editarCuenta(id) {
  const c = cuentas.find(x => x.id === id);
  if (!c) return;

  document.getElementById('edit-cta-id').value = c.id;
  document.getElementById('cta-input-nombre').value = c.nombre;
  document.getElementById('cta-input-inicial').value = c.saldoInicial;
  document.getElementById('cta-input-actual').value = c.saldoActual;
  document.getElementById('cta-input-part').value = c.participacion;
  document.getElementById('form-cta-titulo').innerText = 'Modificar Cuenta';
  document.getElementById('btn-guardar-cta').innerText = 'Guardar Cambios';
  document.getElementById('btn-cancelar-cta').classList.remove('hidden');
}

function eliminarCuenta(id, e) {
  e.stopPropagation();
  if (confirm('¿Eliminar esta cuenta bancaria?')) {
    cuentas = cuentas.filter(c => c.id !== id);
    saveState();
    calcularFinanzas();
  }
}

function cancelarEdicionCuenta() {
  document.getElementById('edit-cta-id').value = '';
  document.getElementById('cta-input-nombre').value = '';
  document.getElementById('cta-input-inicial').value = '';
  document.getElementById('cta-input-actual').value = '';
  document.getElementById('cta-input-part').value = '100';
  document.getElementById('form-cta-titulo').innerText = 'Añadir / Editar Cuenta Bancaria';
  document.getElementById('btn-guardar-cta').innerText = '+ Guardar Cuenta';
  document.getElementById('btn-cancelar-cta').classList.add('hidden');
}

function renderCuentas() {
  const container = document.getElementById('lista-cuentas-maestro');
  container.innerHTML = '';

  cuentas.forEach(c => {
    const dif = c.saldoActual - c.saldoInicial;
    const miSaldoPropio = c.saldoActual * (c.participacion / 100);
    const colorEvol = amountClass(dif);
    const signoEvol = dif >= 0 ? '+' : '';

    container.innerHTML += `
      <div onclick="editarCuenta(${c.id})" class="p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-300 cursor-pointer transition space-y-2">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-xs font-bold text-gray-800">${c.nombre}</h3>
            <span class="text-[10px] ${amountClass(c.participacion)} font-semibold">${c.participacion}% Titularidad Propia</span>
          </div>
          <button onclick="eliminarCuenta(${c.id}, event)" class="text-rose-400 hover:text-rose-600 text-xs font-bold">🗑️</button>
        </div>
        <div class="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
          <div>
            <span class="text-[9px] text-gray-400 block uppercase">Inicial</span>
            <span class="text-xs font-bold ${amountClass(c.saldoInicial)} tabular-amount">${fmt(c.saldoInicial)}</span>
          </div>
          <div>
            <span class="text-[9px] text-gray-400 block uppercase">Actual Total</span>
            <span class="text-xs font-bold ${amountClass(c.saldoActual)} tabular-amount">${fmt(c.saldoActual)}</span>
          </div>
          <div>
            <span class="text-[9px] text-gray-400 block uppercase">Evolución</span>
            <span class="text-xs font-extrabold ${colorEvol}">${signoEvol}${fmt(dif)}</span>
          </div>
        </div>
        <div class="flex justify-between items-center pt-1 border-t border-gray-100 text-xs">
          <span class="text-gray-500 text-[11px]">Tu Saldo Real Disponible:</span>
          <span class="font-extrabold ${amountClass(miSaldoPropio)} tabular-amount">${fmt(miSaldoPropio)}</span>
        </div>
      </div>
    `;
  });
}

function toggleModoTransferencia() {
  const esTransf = document.getElementById('input-es-transferencia').checked;
  document.getElementById('campo-categoria').classList.toggle('hidden', esTransf);
  document.getElementById('campo-cuenta-unica').classList.toggle('hidden', esTransf);
  document.getElementById('campo-cuentas-transferencia').classList.toggle('hidden', !esTransf);
}

function aplicarEfectoSaldo(mov, revertir = false) {
  const factor = revertir ? -1 : 1;
  if (mov.esTransferencia) {
    const cOrigen = cuentas.find(c => c.id === mov.cuentaOrigenId);
    const cDestino = cuentas.find(c => c.id === mov.cuentaDestinoId);
    if (cOrigen) cOrigen.saldoActual -= mov.importe * factor;
    if (cDestino) cDestino.saldoActual += mov.importe * factor;
  } else {
    const c = cuentas.find(x => x.id === mov.cuentaId);
    if (c) {
      const tipo = obtenerTipoPorCategoria(mov.categoria);
      if (tipo === 'INGRESO') c.saldoActual += mov.importe * factor;
      else c.saldoActual -= mov.importe * factor;
    }
  }
}

function guardarMovimiento() {
  const editId = document.getElementById('edit-mov-id').value;
  const concepto = document.getElementById('input-concepto').value || 'Movimiento vario';
  const importe = Number(document.getElementById('input-importe').value);
  const fecha = document.getElementById('input-fecha').value || new Date().toISOString().split('T')[0];
  const participacion = Number(document.getElementById('input-participacion').value) || 100;
  const esTransferencia = document.getElementById('input-es-transferencia').checked;

  if (!importe || importe <= 0) return alert('Por favor, introduce un importe válido');
  if (cuentas.length === 0) return alert('Debes crear al menos una cuenta bancaria antes.');

  const nuevoMov = { concepto, importe, fecha, participacion, esTransferencia };

  if (esTransferencia) {
    const origenId = Number(document.getElementById('input-cuenta-origen').value);
    const destinoId = Number(document.getElementById('input-cuenta-destino').value);
    if (origenId === destinoId) return alert('La cuenta origen y destino no pueden ser la misma.');
    nuevoMov.cuentaOrigenId = origenId;
    nuevoMov.cuentaDestinoId = destinoId;
    nuevoMov.categoria = 'Transferencia';
  } else {
    const ctaId = Number(document.getElementById('input-cuenta').value);
    if (!ctaId) return alert('Selecciona una cuenta válida');
    nuevoMov.cuentaId = ctaId;
    nuevoMov.categoria = document.getElementById('input-categoria').value;
  }

  if (editId) {
    const idx = movimientos.findIndex(m => m.id == editId);
    if (idx !== -1) {
      aplicarEfectoSaldo(movimientos[idx], true);
      nuevoMov.id = movimientos[idx].id;
      movimientos[idx] = nuevoMov;
      aplicarEfectoSaldo(nuevoMov, false);
    }
  } else {
    nuevoMov.id = Date.now();
    movimientos.unshift(nuevoMov);
    aplicarEfectoSaldo(nuevoMov, false);
  }

  saveState();
  cancelarEdicionMovimiento();
  calcularFinanzas();
}

function editarMovimiento(id) {
  const m = movimientos.find(x => x.id === id);
  if (!m) return;

  document.getElementById('edit-mov-id').value = m.id;
  document.getElementById('input-concepto').value = m.concepto;
  document.getElementById('input-importe').value = m.importe;
  document.getElementById('input-fecha').value = m.fecha;
  document.getElementById('input-participacion').value = m.participacion;
  document.getElementById('input-es-transferencia').checked = m.esTransferencia || false;
  toggleModoTransferencia();

  if (m.esTransferencia) {
    if (m.cuentaOrigenId) document.getElementById('input-cuenta-origen').value = m.cuentaOrigenId;
    if (m.cuentaDestinoId) document.getElementById('input-cuenta-destino').value = m.cuentaDestinoId;
  } else {
    document.getElementById('input-categoria').value = m.categoria;
    if (m.cuentaId) document.getElementById('input-cuenta').value = m.cuentaId;
  }

  document.getElementById('form-mov-titulo').innerText = 'Modificar Movimiento';
  document.getElementById('btn-guardar-mov').innerText = 'Guardar Cambios';
  document.getElementById('btn-cancelar-edit').classList.remove('hidden');
}

function eliminarMovimiento(id, e) {
  e.stopPropagation();
  if (confirm('¿Eliminar este movimiento?')) {
    const m = movimientos.find(x => x.id === id);
    if (m) aplicarEfectoSaldo(m, true);
    movimientos = movimientos.filter(m => m.id !== id);
    saveState();
    calcularFinanzas();
  }
}

function cancelarEdicionMovimiento() {
  document.getElementById('edit-mov-id').value = '';
  document.getElementById('input-concepto').value = '';
  document.getElementById('input-importe').value = '';
  document.getElementById('input-fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('input-participacion').value = '100';
  document.getElementById('input-es-transferencia').checked = false;
  toggleModoTransferencia();
  document.getElementById('form-mov-titulo').innerText = 'Añadir Nuevo Movimiento';
  document.getElementById('btn-guardar-mov').innerText = '+ Registrar Movimiento';
  document.getElementById('btn-cancelar-edit').classList.add('hidden');
}

function renderMovimientos() {
  const container = document.getElementById('lista-movimientos');
  const filtro = (document.getElementById('input-buscar-mov')?.value || '').toLowerCase();
  container.innerHTML = '';

  const filtrados = movimientos.filter(m =>
    m.concepto.toLowerCase().includes(filtro) ||
    (m.categoria && m.categoria.toLowerCase().includes(filtro))
  );

  if (!filtrados.length) {
    container.innerHTML = '<p class="text-center text-xs text-gray-400 py-4">No se encontraron movimientos.</p>';
    return;
  }

  filtrados.forEach(m => {
    const miImporte = m.importe * (m.participacion / 100);
    let color = 'amount-neutral';
    let signo = '-';
    let ctaTxt = '';

    if (m.esTransferencia) {
      color = 'amount-neutral';
      signo = '🔄 ';
      const cOrig = cuentas.find(c => c.id === m.cuentaOrigenId);
      const cDest = cuentas.find(c => c.id === m.cuentaDestinoId);
      ctaTxt = `${cOrig ? cOrig.nombre : 'Cuenta'} ➔ ${cDest ? cDest.nombre : 'Cuenta'}`;
    } else {
      const tipo = obtenerTipoPorCategoria(m.categoria);
      color = tipo === 'INGRESO' ? 'amount-positive' : 'amount-negative';
      signo = tipo === 'INGRESO' ? '+' : '-';
      const c = cuentas.find(x => x.id === m.cuentaId);
      ctaTxt = c ? c.nombre : 'Sin Cuenta';
    }

    const colorParticipacion = amountClass(m.participacion);
    container.innerHTML += `
      <div onclick="editarMovimiento(${m.id})" class="flex justify-between items-center p-3 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-indigo-300 cursor-pointer transition">
        <div>
          <p class="text-xs font-bold text-gray-800">${m.concepto}</p>
          <p class="text-[10px] text-gray-400">${m.esTransferencia ? '🔄 Transferencia' : m.categoria} • <span class="font-medium text-indigo-600">${ctaTxt}</span> • <span class="font-semibold text-gray-600">${m.fecha}</span>${m.participacion < 100 ? ` • <span class="font-semibold ${colorParticipacion}">${m.participacion}%</span>` : ''}</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-right">
            <span class="text-xs font-extrabold ${color} tabular-amount block">${signo}${fmt(miImporte)}</span>
            ${m.participacion < 100 ? `<span class="text-[9px] ${m.esTransferencia ? 'amount-neutral' : obtenerTipoPorCategoria(m.categoria) === 'INGRESO' ? 'amount-positive' : 'amount-negative'} tabular-amount">Total: ${fmt(m.importe)}</span>` : ''}
          </div>
          <button onclick="eliminarMovimiento(${m.id}, event)" class="text-rose-400 hover:text-rose-600 font-bold text-sm">🗑️</button>
        </div>
      </div>
    `;
  });
}

function guardarPresupuesto() {
  const cat = document.getElementById('pres-input-cat').value;
  const importeMov = Number(document.getElementById('pres-input-monto').value);
  const numMovs = Number(document.getElementById('pres-input-num-mov').value) || 12;

  if (!importeMov || importeMov < 0) return alert('Introduce un importe válido');

  const pres = presupuestos.find(p => p.categoria === cat);
  if (pres) {
    pres.importeMovimiento = importeMov;
    pres.numMovimientosAnuales = numMovs;
  } else {
    presupuestos.push({ categoria: cat, importeMovimiento: importeMov, numMovimientosAnuales: numMovs });
  }

  document.getElementById('pres-input-monto').value = '';
  saveState();
  calcularFinanzas();
}

function eliminarPresupuesto(categoria) {
  if (confirm(`¿Eliminar presupuesto asignado a ${categoria}?`)) {
    presupuestos = presupuestos.filter(p => p.categoria !== categoria);
    saveState();
    calcularFinanzas();
  }
}

function renderPresupuestos() {
  const container = document.getElementById('lista-presupuestos');
  container.innerHTML = '';

  const ingresosAnualesPresupuestados = presupuestos
    .filter(p => obtenerTipoPorCategoria(p.categoria) === 'INGRESO')
    .reduce((acc, p) => acc + (p.importeMovimiento * p.numMovimientosAnuales), 0);

  let totalGastoHogarAnual = 0;
  let totalGastoOcioAnual = 0;

  presupuestos.forEach(p => {
    const catObj = categorias.find(c => c.nombre === p.categoria);
    const grupo = catObj ? catObj.grupo : 'Gasto del hogar';
    const totalAnualCat = p.importeMovimiento * p.numMovimientosAnuales;

    if (grupo === 'Gasto del hogar') totalGastoHogarAnual += totalAnualCat;
    if (grupo === 'Gasto en ocio') totalGastoOcioAnual += totalAnualCat;
  });

  const pctHogarGlobal = ingresosAnualesPresupuestados > 0 ? (totalGastoHogarAnual / ingresosAnualesPresupuestados) * 100 : 0;
  const pctOcioGlobal = ingresosAnualesPresupuestados > 0 ? (totalGastoOcioAnual / ingresosAnualesPresupuestados) * 100 : 0;
  const pctAhorroGlobal = Math.max(0, 100 - pctHogarGlobal - pctOcioGlobal);
  const montoAhorroAnual = ingresosAnualesPresupuestados - totalGastoHogarAnual - totalGastoOcioAnual;

  setSignedValue('pres-total-ingresos-lbl', `Ingresos: ${fmt(ingresosAnualesPresupuestados)}/año`, ingresosAnualesPresupuestados);
  setSignedValue('pres-pct-hogar', `${pctHogarGlobal.toFixed(1)}%`, pctHogarGlobal);
  setSignedValue('pres-pct-ocio', `${pctOcioGlobal.toFixed(1)}%`, pctOcioGlobal);
  setSignedValue('pres-pct-ahorro', `${pctAhorroGlobal.toFixed(1)}% (${fmt(montoAhorroAnual)})`, montoAhorroAnual);
  document.getElementById('bar-hogar').style.width = `${Math.min(100, pctHogarGlobal)}%`;
  document.getElementById('bar-ocio').style.width = `${Math.min(100 - pctHogarGlobal, pctOcioGlobal)}%`;
  document.getElementById('bar-ahorro').style.width = `${Math.min(100, pctAhorroGlobal)}%`;

  presupuestos.forEach(p => {
    const multEscala = vistaActual === 'ANIO' ? 12 : 1;
    const catObj = categorias.find(c => c.nombre === p.categoria);
    const grupo = catObj ? catObj.grupo : 'Gasto del hogar';
    const esIngreso = grupo === 'Ingreso';
    const mensualBase = (p.importeMovimiento * p.numMovimientosAnuales) / 12;
    const totalAnual = p.importeMovimiento * p.numMovimientosAnuales;
    const asignadoEscalado = mensualBase * multEscala;
    const pctSobreIngreso = ingresosAnualesPresupuestados > 0 ? (totalAnual / ingresosAnualesPresupuestados) * 100 : 0;
    const gastado = movimientos
      .filter(m => perteneceAlPeriodo(m.fecha))
      .filter(m => !m.esTransferencia && m.categoria === p.categoria)
      .reduce((acc, m) => acc + (m.importe * (m.participacion / 100)), 0);
    const pctEjecucion = !esIngreso ? Math.min(100, Math.round((gastado / asignadoEscalado) * 100)) : 100;
    const colorBarra = pctEjecucion > 90 ? 'bg-rose-500' : 'bg-indigo-600';

    let badgeGrupo = '';
    if (esIngreso) badgeGrupo = '<span class="bg-emerald-100 text-emerald-800 text-[9px] px-2 py-0.5 rounded-full font-bold">🟢 Ingreso</span>';
    else if (grupo === 'Gasto del hogar') badgeGrupo = '<span class="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded-full font-bold">🏠 Hogar</span>';
    else badgeGrupo = '<span class="bg-purple-100 text-purple-800 text-[9px] px-2 py-0.5 rounded-full font-bold">🎉 Ocio</span>';

    container.innerHTML += `
      <div class="p-3.5 bg-white rounded-xl border border-gray-100 shadow-sm space-y-2">
        <div class="flex justify-between items-center text-xs">
          <div class="flex items-center gap-1.5">
            <span class="text-gray-800 font-bold">${p.categoria}</span>
            ${badgeGrupo}
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-medium tabular-amount"><span class="${esIngreso ? amountClass(gastado) : 'amount-negative'}">${fmt(gastado)}</span> / <span class="${esIngreso ? amountClass(asignadoEscalado) : 'amount-negative'}">${fmt(asignadoEscalado)}</span></span>
            <button onclick="eliminarPresupuesto('${p.categoria}')" class="text-rose-400 hover:text-rose-600 text-xs font-bold">✕</button>
          </div>
        </div>
        <div class="flex justify-between items-center text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
          <span>Recurrencia: <strong class="${amountClass(p.numMovimientosAnuales)}">${p.numMovimientosAnuales} movs/año</strong> de <strong class="${esIngreso ? amountClass(p.importeMovimiento) : 'amount-negative'} tabular-amount">${fmt(p.importeMovimiento)}</strong></span>
          <div class="text-right">
            <span class="block">Anual: <strong class="${esIngreso ? amountClass(totalAnual) : 'amount-negative'} tabular-amount">${fmt(totalAnual)}</strong></span>
            ${!esIngreso ? `<span class="${amountClass(pctSobreIngreso)} font-bold">${pctSobreIngreso.toFixed(1)}% s/ingresos</span>` : ''}
          </div>
        </div>
        ${!esIngreso ? `<div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden"><div class="${colorBarra} h-full rounded-full" style="width: ${pctEjecucion}%"></div></div>` : ''}
      </div>
    `;
  });
}

function cfgAgregarCategoria() {
  const nombre = document.getElementById('cfg-cat-nombre').value;
  const grupo = document.getElementById('cfg-cat-grupo').value;
  if (!nombre) return;

  categorias.push({ id: Date.now(), nombre, grupo });
  document.getElementById('cfg-cat-nombre').value = '';
  saveState();
  calcularFinanzas();
}

function cfgEliminarCategoria(id) {
  categorias = categorias.filter(c => c.id !== id);
  saveState();
  calcularFinanzas();
}

function renderConfiguracion() {
  const catContainer = document.getElementById('cfg-lista-categorias');
  catContainer.innerHTML = '';
  categorias.forEach(c => {
    const colorBadge = c.grupo === 'Ingreso' ? 'text-emerald-600' : c.grupo === 'Gasto del hogar' ? 'text-amber-600' : 'text-purple-600';
    catContainer.innerHTML += `
      <div class="flex justify-between items-center p-2 bg-gray-50 rounded text-xs border border-gray-100">
        <div>
          <span class="font-bold text-gray-700 block">${c.nombre}</span>
          <span class="text-[9px] font-semibold ${colorBadge}">${c.grupo}</span>
        </div>
        <button onclick="cfgEliminarCategoria(${c.id})" class="text-rose-500 font-bold hover:text-rose-700">✕</button>
      </div>
    `;
  });

  const ejercicioSelect = document.getElementById('selector-ejercicio');
  ejercicioSelect.innerHTML = ejercicios.map(e =>
    `<option value="${escaparHtml(e.id)}" ${e.id === ejercicioActivoId ? 'selected' : ''}>${escaparHtml(e.nombre)}</option>`
  ).join('');
}

function escaparHtml(valor) {
  return String(valor).replace(/[&<>"']/g, caracter => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[caracter]);
}

async function seleccionarEjercicio(id) {
  if (!ejercicios.some(e => e.id === id) || id === ejercicioActivoId) return;
  await saveState();
  await guardarEstadoSimulacion();
  ejercicioActivoId = id;
  await guardarMetaEjercicios();

  const db = await openDatabase();
  const data = db
    ? (await leerRegistro(db, `exercise:${id}`))?.data
    : JSON.parse(localStorage.getItem(`exercise:${id}`) || 'null');
  aplicarDatosEjercicio(data || defaultData);
  if (!(await cargarEstadoSimulacion())) {
    simPresupuestos = clonarDatos(presupuestos);
    simCuentas = clonarDatos(cuentas);
    await guardarEstadoSimulacion();
  }

  cancelarEdicionCuenta();
  cancelarEdicionMovimiento();
  const nombre = ejercicios.find(e => e.id === id).nombre;
  document.getElementById('periodo-titulo').innerText = vistaActual === 'MES' ? `Septiembre ${nombre}` : `Ejercicio ${nombre}`;
  renderSimulacion();
  calcularFinanzas();
}

async function crearEjercicio() {
  const nombreInput = document.getElementById('input-nombre-ejercicio');
  const nombre = nombreInput.value.trim();
  if (!nombre) return alert('Introduce un nombre para el ejercicio');
  if (ejercicios.some(e => e.nombre.toLowerCase() === nombre.toLowerCase())) return alert('Ya existe un ejercicio con ese nombre');

  await saveState();
  await guardarEstadoSimulacion();
  const id = String(Date.now());
  const datos = {
    cuentas: cuentas.map(c => ({ ...c, saldoInicial: Number(c.saldoActual || 0), saldoActual: Number(c.saldoActual || 0) })),
    categorias: clonarDatos(categorias),
    presupuestos: clonarDatos(presupuestos),
    movimientos: []
  };
  await guardarDatosEjercicio(id, datos);
  ejercicios.push({ id, nombre });
  ejercicioActivoId = id;
  await guardarMetaEjercicios();
  aplicarDatosEjercicio(datos);
  simPresupuestos = clonarDatos(presupuestos);
  simCuentas = clonarDatos(cuentas);
  await guardarEstadoSimulacion();
  nombreInput.value = '';
  document.getElementById('periodo-titulo').innerText = vistaActual === 'MES' ? `Septiembre ${nombre}` : `Ejercicio ${nombre}`;
  cancelarEdicionCuenta();
  cancelarEdicionMovimiento();
  renderSimulacion();
  calcularFinanzas();
}

async function renombrarEjercicio() {
  const nombre = document.getElementById('input-nombre-ejercicio').value.trim();
  if (!nombre) return alert('Introduce un nombre para el ejercicio');
  if (ejercicios.some(e => e.id !== ejercicioActivoId && e.nombre.toLowerCase() === nombre.toLowerCase())) return alert('Ya existe un ejercicio con ese nombre');
  const ejercicio = ejercicios.find(e => e.id === ejercicioActivoId);
  ejercicio.nombre = nombre;
  await guardarMetaEjercicios();
  document.getElementById('input-nombre-ejercicio').value = '';
  document.getElementById('periodo-titulo').innerText = vistaActual === 'MES' ? `Septiembre ${nombre}` : `Ejercicio ${nombre}`;
  renderConfiguracion();
}

async function eliminarEjercicio() {
  if (ejercicios.length <= 1) return alert('Debe quedar al menos un ejercicio');
  const ejercicio = ejercicios.find(e => e.id === ejercicioActivoId);
  if (!confirm(`¿Eliminar el ejercicio "${ejercicio.nombre}" y todos sus datos?`)) return;

  const eliminadoId = ejercicioActivoId;
  ejercicios = ejercicios.filter(e => e.id !== eliminadoId);
  ejercicioActivoId = ejercicios[0].id;
  const db = await openDatabase();
  if (db) {
    await eliminarRegistro(db, `exercise:${eliminadoId}`);
    await eliminarRegistro(db, `simulation:${eliminadoId}`);
  } else {
    localStorage.removeItem(`exercise:${eliminadoId}`);
    localStorage.removeItem(`simulation:${eliminadoId}`);
  }
  await guardarMetaEjercicios(db);

  const nextId = ejercicioActivoId;
  const data = db
    ? (await leerRegistro(db, `exercise:${nextId}`))?.data
    : JSON.parse(localStorage.getItem(`exercise:${nextId}`) || 'null');
  aplicarDatosEjercicio(data || defaultData);
  if (!(await cargarEstadoSimulacion())) {
    simPresupuestos = clonarDatos(presupuestos);
    simCuentas = clonarDatos(cuentas);
    await guardarEstadoSimulacion();
  }
  cancelarEdicionCuenta();
  cancelarEdicionMovimiento();
  const nombre = ejercicios.find(e => e.id === nextId).nombre;
  document.getElementById('periodo-titulo').innerText = vistaActual === 'MES' ? `Septiembre ${nombre}` : `Ejercicio ${nombre}`;
  renderSimulacion();
  calcularFinanzas();
}

function eliminarRegistro(db, id) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function actualizarSelectoresCategorias() {
  const selMov = document.getElementById('input-categoria');
  const selPres = document.getElementById('pres-input-cat');
  const html = categorias.map(c => `<option value="${c.nombre}">${c.nombre} (${c.grupo})</option>`).join('');
  if (selMov) selMov.innerHTML = html;
  if (selPres) selPres.innerHTML = html;
}

function actualizarSelectoresCuentas() {
  const selCta = document.getElementById('input-cuenta');
  const selOrigen = document.getElementById('input-cuenta-origen');
  const selDestino = document.getElementById('input-cuenta-destino');
  const html = cuentas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  if (selCta) selCta.innerHTML = html;
  if (selOrigen) selOrigen.innerHTML = html;
  if (selDestino) selDestino.innerHTML = html;
}

function cambiarVistaTemporal(valor) {
  vistaActual = valor;
  actualizarTituloPeriodo();
  document.getElementById('lbl-kpi-forecast').innerText = valor === 'MES' ? 'Cierre mes' : 'Cierre año';
  document.getElementById('txt-vista-actual').innerText = valor === 'MES' ? 'Mes' : 'Año Completo';
  calcularFinanzas();
}

function cambiarPeriodo(valor) {
  if (!/^\d{4}-\d{2}$/.test(valor)) return;
  periodoSeleccionado = valor;
  actualizarTituloPeriodo();
  calcularFinanzas();
}

function perteneceAlPeriodo(fecha) {
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  return vistaActual === 'ANIO'
    ? fecha.startsWith(periodoSeleccionado.slice(0, 4))
    : fecha.startsWith(periodoSeleccionado);
}

function actualizarTituloPeriodo() {
  const [anio, mes] = periodoSeleccionado.split('-').map(Number);
  const fechaPeriodo = new Date(anio, mes - 1, 1);
  const nombreMes = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(fechaPeriodo);
  const nombreEjercicio = ejercicios.find(e => e.id === ejercicioActivoId)?.nombre || String(anio);
  const selectorPeriodo = document.getElementById('selector-periodo');
  document.getElementById('periodo-titulo').innerText = vistaActual === 'MES'
    ? `${nombreMes.charAt(0).toUpperCase()}${nombreMes.slice(1)} ${anio}`
    : `Ejercicio ${anio}${nombreEjercicio !== String(anio) ? ` · ${nombreEjercicio}` : ''}`;
  selectorPeriodo.value = periodoSeleccionado;
  selectorPeriodo.hidden = vistaActual === 'ANIO';
}

function resetSimulacion() {
  simPresupuestos = presupuestos.map(p => ({ ...p }));
  simCuentas = cuentas.map(c => ({ ...c }));
  renderSimulacion();
  guardarEstadoSimulacion();
}

function calcularResultadoSimulacion() {
  const saldoSimuladoCuentas = simCuentas.reduce((acc, c) => acc + (Number(c.saldoActual || 0) * (Number(c.participacion ?? 100) / 100)), 0);
  const saldoInicialCuentas = cuentas.reduce((acc, c) => acc + (Number(c.saldoInicial || 0) * (Number(c.participacion ?? 100) / 100)), 0);
  const ingresosSimulados = simPresupuestos
    .filter(p => obtenerTipoPorCategoria(p.categoria) === 'INGRESO')
    .reduce((acc, p) => acc + (Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0)), 0);
  const ingresosAnualesPresupuestados = presupuestos
    .filter(p => obtenerTipoPorCategoria(p.categoria) === 'INGRESO')
    .reduce((acc, p) => acc + (Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0)), 0);
  const gastosSimulados = simPresupuestos
    .filter(p => obtenerTipoPorCategoria(p.categoria) === 'GASTO')
    .reduce((acc, p) => acc + (Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0)), 0);
  const forecast = saldoSimuladoCuentas + ingresosSimulados - gastosSimulados;
  const capacidadAhorroImporte = forecast - saldoInicialCuentas;
  const capacidadAhorroPct = ingresosAnualesPresupuestados > 0 ? (capacidadAhorroImporte / ingresosAnualesPresupuestados) * 100 : 0;

  return {
    forecast,
    saldoSimuladoCuentas,
    ingresosSimulados,
    gastosSimulados,
    capacidadAhorroImporte,
    capacidadAhorroPct
  };
}

function actualizarSimPresupuesto(index, campo, valor, input) {
  const item = simPresupuestos[index];
  if (!item) return;
  item[campo] = Number(valor) || 0;
  actualizarClaseImporte(input, Number(valor));
  const totalAnual = Number(item.importeMovimiento || 0) * Number(item.numMovimientosAnuales || 0);
  setSignedValue(`sim-pres-total-${index}`, `${fmt(totalAnual)}/año`, totalAnual);
  actualizarResumenSimulacion();
  guardarEstadoSimulacion();
}

function actualizarSimCuenta(id, valor, input) {
  const cuenta = simCuentas.find(c => c.id === id);
  if (!cuenta) return;
  cuenta.saldoActual = Number(valor) || 0;
  actualizarClaseImporte(input, Number(valor));
  actualizarResumenSimulacion();
  guardarEstadoSimulacion();
}

function actualizarResumenSimulacion() {
  const datos = calcularResultadoSimulacion();

  const ingresosAnualesPresupuestados = simPresupuestos
    .filter(p => obtenerTipoPorCategoria(p.categoria) === 'INGRESO')
    .reduce((acc, p) => acc + (Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0)), 0);

  let totalGastoHogarAnual = 0;
  let totalGastoOcioAnual = 0;

  simPresupuestos.forEach(p => {
    const catObj = categorias.find(c => c.nombre === p.categoria);
    const grupo = catObj ? catObj.grupo : 'Gasto del hogar';
    const totalAnualCat = Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0);
    if (grupo === 'Gasto del hogar') totalGastoHogarAnual += totalAnualCat;
    if (grupo === 'Gasto en ocio') totalGastoOcioAnual += totalAnualCat;
  });

  const pctHogarGlobal = ingresosAnualesPresupuestados > 0 ? (totalGastoHogarAnual / ingresosAnualesPresupuestados) * 100 : 0;
  const pctOcioGlobal = ingresosAnualesPresupuestados > 0 ? (totalGastoOcioAnual / ingresosAnualesPresupuestados) * 100 : 0;
  const pctAhorroGlobal = Math.max(0, 100 - pctHogarGlobal - pctOcioGlobal);

  setSignedValue('sim-total-ingresos-lbl', `Ingresos: ${fmt(ingresosAnualesPresupuestados)}/año`, ingresosAnualesPresupuestados);
  setSignedValue('sim-pct-hogar', `${pctHogarGlobal.toFixed(1)}%`, pctHogarGlobal);
  setSignedValue('sim-pct-ocio', `${pctOcioGlobal.toFixed(1)}%`, pctOcioGlobal);
  setSignedValue('sim-pct-ahorro', `${pctAhorroGlobal.toFixed(1)}%`, pctAhorroGlobal);
  document.getElementById('sim-bar-hogar').style.width = `${Math.min(100, pctHogarGlobal)}%`;
  document.getElementById('sim-bar-ocio').style.width = `${Math.min(100 - pctHogarGlobal, pctOcioGlobal)}%`;
  document.getElementById('sim-bar-ahorro').style.width = `${Math.min(100, pctAhorroGlobal)}%`;

  setSignedAmount('sim-forecast', datos.forecast);
  setSignedAmount('sim-saldo-real', datos.saldoSimuladoCuentas);
  setSignedAmount('sim-ahorro-importe', datos.capacidadAhorroImporte);
  setSignedValue('sim-ahorro-pct', `${datos.capacidadAhorroPct.toFixed(1)}%`, datos.capacidadAhorroPct);
}

function renderSimulacion() {
  actualizarResumenSimulacion();

  const simPresupuestoContainer = document.getElementById('sim-lista-presupuestos');
  simPresupuestoContainer.innerHTML = '';
  simPresupuestos.forEach((p, index) => {
    const catObj = categorias.find(c => c.nombre === p.categoria);
    const grupo = catObj ? catObj.grupo : 'Gasto del hogar';
    const badge = grupo === 'Ingreso'
      ? '<span class="bg-emerald-100 text-emerald-700 text-[9px] px-2 py-0.5 rounded-full font-bold">Ingreso</span>'
      : grupo === 'Gasto del hogar'
        ? '<span class="bg-amber-100 text-amber-700 text-[9px] px-2 py-0.5 rounded-full font-bold">Hogar</span>'
        : '<span class="bg-purple-100 text-purple-700 text-[9px] px-2 py-0.5 rounded-full font-bold">Ocio</span>';

    simPresupuestoContainer.innerHTML += `
      <div class="bg-white rounded-xl border border-gray-200 p-2.5 space-y-2">
        <div class="flex justify-between items-center gap-2">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-gray-800">${p.categoria}</span>
            ${badge}
          </div>
          <span id="sim-pres-total-${index}" class="text-[10px] ${amountClass(Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0))} tabular-amount">${fmt(Number(p.importeMovimiento || 0) * Number(p.numMovimientosAnuales || 0))}/año</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[9px] text-gray-500 font-bold block mb-1">Importe</label>
            <input type="number" value="${Number(p.importeMovimiento || 0)}" oninput="actualizarSimPresupuesto(${index}, 'importeMovimiento', this.value, this)" class="w-full h-9 px-2 text-xs border rounded-lg bg-white ${amountClass(p.importeMovimiento)}">
          </div>
          <div>
            <label class="text-[9px] text-gray-500 font-bold block mb-1">Nº movs</label>
            <input type="number" min="1" value="${Number(p.numMovimientosAnuales || 0)}" oninput="actualizarSimPresupuesto(${index}, 'numMovimientosAnuales', this.value, this)" class="w-full h-9 px-2 text-xs border rounded-lg bg-white ${amountClass(p.numMovimientosAnuales)}">
          </div>
        </div>
      </div>
    `;
  });

  const simCuentaContainer = document.getElementById('sim-lista-cuentas');
  simCuentaContainer.innerHTML = '';
  simCuentas.forEach(c => {
    simCuentaContainer.innerHTML += `
      <div class="bg-white rounded-xl border border-gray-200 p-2.5">
        <div class="flex justify-between items-center mb-2">
          <span class="text-xs font-bold text-gray-800">${c.nombre}</span>
          <span class="text-[10px] ${amountClass(Number(c.participacion || 100))} font-semibold">${Number(c.participacion || 100)}% propio</span>
        </div>
        <label class="text-[9px] text-gray-500 font-bold block mb-1">Importe</label>
        <input type="number" value="${Number(c.saldoActual || 0)}" oninput="actualizarSimCuenta(${c.id}, this.value, this)" class="w-full h-9 px-2 text-xs border rounded-lg bg-white ${amountClass(c.saldoActual)}">
      </div>
    `;
  });
}

function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.toggle('hidden');
}

function toggleAcordion(id) {
  document.getElementById(id).classList.toggle('hidden');
}

function switchTab(tab) {
  ['resumen', 'cuentas', 'movimientos', 'presupuesto', 'simular'].forEach(t => {
    document.getElementById(`sec-${t}`).classList.add('hidden');
    document.getElementById(`tab-${t}`).classList.remove('border-b-2', 'border-indigo-600', 'text-indigo-600');
    document.getElementById(`tab-${t}`).classList.add('text-gray-500');
  });

  document.getElementById(`sec-${tab}`).classList.remove('hidden');
  document.getElementById(`tab-${tab}`).classList.add('border-b-2', 'border-indigo-600', 'text-indigo-600');
  document.getElementById(`tab-${tab}`).classList.remove('text-gray-500');
}

function fmt(val) {
  return Number(val).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

function amountClass(value) {
  return value > 0 ? 'amount-positive' : value < 0 ? 'amount-negative' : 'amount-neutral';
}

function actualizarClaseImporte(element, value) {
  if (!element) return;
  element.classList.remove('amount-positive', 'amount-negative', 'amount-neutral');
  element.classList.add(amountClass(value));
}

function setSignedValue(id, text, signValue) {
  const element = typeof id === 'string' ? document.getElementById(id) : id;
  if (!element) return;
  element.innerText = text;
  actualizarClaseImporte(element, signValue);
}

function setSignedAmount(id, value, prefix = '', negativeAsMagnitude = false) {
  const displayValue = negativeAsMagnitude ? `${prefix}${fmt(Math.abs(value))}` : `${prefix}${fmt(value)}`;
  setSignedValue(id, displayValue, negativeAsMagnitude ? -Math.abs(value) : value);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  });
}

window.toggleMenu = toggleMenu;
window.toggleAcordion = toggleAcordion;
window.switchTab = switchTab;
window.cambiarVistaTemporal = cambiarVistaTemporal;
window.cambiarPeriodo = cambiarPeriodo;
window.resetSimulacion = resetSimulacion;
window.actualizarSimPresupuesto = actualizarSimPresupuesto;
window.actualizarSimCuenta = actualizarSimCuenta;
window.cfgAgregarCategoria = cfgAgregarCategoria;
window.cfgEliminarCategoria = cfgEliminarCategoria;
window.seleccionarEjercicio = seleccionarEjercicio;
window.crearEjercicio = crearEjercicio;
window.renombrarEjercicio = renombrarEjercicio;
window.eliminarEjercicio = eliminarEjercicio;
window.guardarCuenta = guardarCuenta;
window.editarCuenta = editarCuenta;
window.eliminarCuenta = eliminarCuenta;
window.cancelarEdicionCuenta = cancelarEdicionCuenta;
window.toggleModoTransferencia = toggleModoTransferencia;
window.guardarMovimiento = guardarMovimiento;
window.editarMovimiento = editarMovimiento;
window.eliminarMovimiento = eliminarMovimiento;
window.cancelarEdicionMovimiento = cancelarEdicionMovimiento;
window.renderMovimientos = renderMovimientos;
window.guardarPresupuesto = guardarPresupuesto;
window.eliminarPresupuesto = eliminarPresupuesto;
window.calcularFinanzas = calcularFinanzas;

loadState().then(async () => {
  if (await cargarEstadoSimulacion()) renderSimulacion();
  else resetSimulacion();
  const fechaMovimientoReciente = movimientos.map(m => m.fecha).filter(Boolean).sort().at(-1);
  if (fechaMovimientoReciente) periodoSeleccionado = fechaMovimientoReciente.slice(0, 7);
  document.getElementById('selector-periodo').value = periodoSeleccionado;
  actualizarTituloPeriodo();
  renderConfiguracion();
  calcularFinanzas();
});
