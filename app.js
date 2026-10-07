// ============================================================
// app.js - Lógica completa del frontend
// Gestiona la interacción con el usuario y la comunicación IPC
// ============================================================

// Número total de slots de tareas
const TOTAL_SLOTS = 6;

// Estado global de la aplicación
const estado = {
  categorias: [],
  empleados: [],
  vehiculos: [],
  fechaActual: '',
  // Trabajadores asignados por slot: { slot: [empleadoId, ...] }
  trabajadoresAsignados: {},
  // Ausencias del día: [{ id, empleado_id, fecha, tipo, empleado_nombre }]
  ausencias: []
};

// ============================================================
// Inicialización
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Establecer fecha de hoy por defecto
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('fecha-input').value = hoy;
  estado.fechaActual = hoy;

  // Cargar datos iniciales
  await cargarCategorias();
  await cargarEmpleados();
  await cargarVehiculos();

  // Generar las 6 tarjetas de tareas
  generarTarjetasTareas();

  // Cargar tareas y ausencias del día actual
  await cargarTareasDia();
  await cargarAusencias();

  // Restaurar estado del panel (colapsado o expandido)
  restaurarEstadoPanel();

  // Registrar eventos
  registrarEventos();
});

// ============================================================
// Registro de eventos
// ============================================================

function registrarEventos() {
  // --- Categorías ---
  document.getElementById('btn-add-categoria').addEventListener('click', agregarCategoria);
  document.getElementById('categoria-nombre').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') agregarCategoria();
  });

  // --- Empleados ---
  document.getElementById('btn-add-empleado').addEventListener('click', agregarEmpleado);
  document.getElementById('empleado-nombre').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') agregarEmpleado();
  });

  // --- Vehículos ---
  document.getElementById('btn-add-vehiculo').addEventListener('click', agregarVehiculo);
  document.getElementById('vehiculo-nombre').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') agregarVehiculo();
  });

  // --- Cargar día ---
  document.getElementById('btn-cargar-dia').addEventListener('click', async () => {
    const fecha = document.getElementById('fecha-input').value;
    if (!fecha) {
      mostrarNotificacion('Seleccione una fecha', 'error');
      return;
    }
    estado.fechaActual = fecha;
    await cargarTareasDia();
    await cargarAusencias();
    mostrarNotificacion('Día cargado correctamente', 'info');
  });

  // --- Guardar y exportar ---
  document.getElementById('btn-guardar').addEventListener('click', guardarYExportar);

  // --- Botón desplegar/colapsar panel ---
  document.getElementById('btn-toggle-panel').addEventListener('click', () => {
    togglePanelIzquierdo();
    guardarEstadoPanel();
  });
}

// ============================================================
// Panel lateral colapsable
// ============================================================

/**
 * Alterna la visibilidad del panel izquierdo completo.
 * Al colapsar, el panel derecho ocupa todo el ancho.
 */
function togglePanelIzquierdo() {
  const panel = document.getElementById('left-panel');
  const btn = document.getElementById('btn-toggle-panel');
  panel.classList.toggle('collapsed');

  if (panel.classList.contains('collapsed')) {
    btn.title = 'Mostrar panel';
  } else {
    btn.title = 'Ocultar panel';
  }
}

/**
 * Guarda el estado del panel (colapsado/expandido) en localStorage.
 */
function guardarEstadoPanel() {
  const panel = document.getElementById('left-panel');
  const estado = panel.classList.contains('collapsed') ? 'collapsed' : 'expanded';
  localStorage.setItem('panelState', estado);
}

/**
 * Restaura el estado del panel desde localStorage.
 */
function restaurarEstadoPanel() {
  const savedState = localStorage.getItem('panelState');
  const panel = document.getElementById('left-panel');
  const btn = document.getElementById('btn-toggle-panel');

  if (savedState === 'collapsed') {
    panel.classList.add('collapsed');
    btn.title = 'Mostrar panel';
  } else {
    panel.classList.remove('collapsed');
    btn.title = 'Ocultar panel';
  }
}

// ============================================================
// Categorías
// ============================================================

/**
 * Carga las categorías desde la BD y actualiza la interfaz.
 */
async function cargarCategorias() {
  const res = await window.api.getCategorias();
  if (res.success) {
    estado.categorias = res.data;
    renderizarCategorias();
    actualizarSelectCategorias();
  } else {
    mostrarNotificacion('Error cargando categorías: ' + res.error, 'error');
  }
}

/**
 * Renderiza la lista de categorías en el panel izquierdo.
 */
function renderizarCategorias() {
  const lista = document.getElementById('categorias-list');
  if (estado.categorias.length === 0) {
    lista.innerHTML = '<div class="empty-state">Sin categorías</div>';
    return;
  }
  lista.innerHTML = estado.categorias
    .map(
      (cat) => `
      <div class="item-row">
        <span class="item-name">${escapeHtml(cat.nombre)}</span>
        <button class="btn-delete" onclick="eliminarCategoria(${cat.id})" title="Eliminar">🗑️</button>
      </div>
    `
    )
    .join('');
}

/**
 * Actualiza el select de categorías en el formulario de empleados.
 */
function actualizarSelectCategorias() {
  const select = document.getElementById('empleado-categoria');
  const valorActual = select.value;
  select.innerHTML = '<option value="">-- Categoría --</option>';
  estado.categorias.forEach((cat) => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.nombre;
    select.appendChild(option);
  });
  if (valorActual) {
    select.value = valorActual;
  }
}

/**
 * Añade una nueva categoría.
 */
async function agregarCategoria() {
  const input = document.getElementById('categoria-nombre');
  const nombre = input.value.trim();
  if (!nombre) {
    mostrarNotificacion('Escriba un nombre de categoría', 'error');
    return;
  }
  const res = await window.api.addCategoria(nombre);
  if (res.success) {
    input.value = '';
    await cargarCategorias();
    await cargarEmpleados();
    mostrarNotificacion(`Categoría "${nombre}" creada`, 'exito');
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

/**
 * Elimina una categoría por ID con opción de deshacer.
 */
async function eliminarCategoria(id) {
  const catBorrada = estado.categorias.find((c) => c.id === id);
  const empsBorrados = estado.empleados.filter((e) => e.categoria_id === id);

  const res = await window.api.deleteCategoria(id);
  if (res.success) {
    await cargarCategorias();
    await cargarEmpleados();
    mostrarNotificacion(`Categoría "${catBorrada?.nombre}" eliminada`, 'info', async () => {
      if (catBorrada) {
        const resCat = await window.api.addCategoria(catBorrada.nombre);
        if (resCat.success) {
          for (const emp of empsBorrados) {
            await window.api.addEmpleado(emp.nombre, resCat.data.id);
          }
          await cargarCategorias();
          await cargarEmpleados();
          mostrarNotificacion('Categoría restaurada', 'exito');
        }
      }
    });
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

// ============================================================
// Empleados
// ============================================================

/**
 * Carga los empleados desde la BD y actualiza la interfaz.
 */
async function cargarEmpleados() {
  const res = await window.api.getEmpleados();
  if (res.success) {
    estado.empleados = res.data;
    renderizarEmpleados();
    actualizarSelectsTrabajadores();
    actualizarSelectsAusencias();
  } else {
    mostrarNotificacion('Error cargando empleados: ' + res.error, 'error');
  }
}

/**
 * Renderiza la lista de empleados en el panel izquierdo.
 */
function renderizarEmpleados() {
  const lista = document.getElementById('empleados-list');
  if (estado.empleados.length === 0) {
    lista.innerHTML = '<div class="empty-state">Sin empleados</div>';
    return;
  }
  lista.innerHTML = estado.empleados
    .map(
      (emp) => `
      <div class="item-row">
        <span class="item-name">${escapeHtml(emp.nombre)}</span>
        <span class="item-category">${escapeHtml(emp.categoria_nombre)}</span>
        <button class="btn-delete" onclick="eliminarEmpleado(${emp.id})" title="Eliminar">🗑️</button>
      </div>
    `
    )
    .join('');
}

/**
 * Añade un nuevo empleado.
 */
async function agregarEmpleado() {
  const inputNombre = document.getElementById('empleado-nombre');
  const selectCat = document.getElementById('empleado-categoria');
  const nombre = inputNombre.value.trim();
  const categoriaId = parseInt(selectCat.value);

  if (!nombre) {
    mostrarNotificacion('Escriba el nombre del empleado', 'error');
    return;
  }
  if (!categoriaId) {
    mostrarNotificacion('Seleccione una categoría', 'error');
    return;
  }

  const res = await window.api.addEmpleado(nombre, categoriaId);
  if (res.success) {
    inputNombre.value = '';
    await cargarEmpleados();
    mostrarNotificacion(`Empleado "${nombre}" añadido`, 'exito');
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

/**
 * Elimina un empleado por ID con opción de deshacer.
 */
async function eliminarEmpleado(id) {
  const empBorrado = estado.empleados.find((e) => e.id === id);

  for (const slot of Object.keys(estado.trabajadoresAsignados)) {
    estado.trabajadoresAsignados[slot] = estado.trabajadoresAsignados[slot].filter(
      (empId) => empId !== id
    );
  }

  const res = await window.api.deleteEmpleado(id);
  if (res.success) {
    await cargarEmpleados();
    renderizarChipsTodosLosSlots();
    mostrarNotificacion(`Empleado "${empBorrado?.nombre}" eliminado`, 'info', async () => {
      if (empBorrado) {
        const resEmp = await window.api.addEmpleado(empBorrado.nombre, empBorrado.categoria_id);
        if (resEmp.success) {
          await cargarEmpleados();
          mostrarNotificacion('Empleado restaurado', 'exito');
        }
      }
    });
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

// ============================================================
// Vehículos
// ============================================================

/**
 * Carga los vehículos desde la BD y actualiza la interfaz.
 */
async function cargarVehiculos() {
  const res = await window.api.getVehiculos();
  if (res.success) {
    estado.vehiculos = res.data;
    renderizarVehiculos();
    actualizarSelectsVehiculos();
  } else {
    mostrarNotificacion('Error cargando vehículos: ' + res.error, 'error');
  }
}

/**
 * Renderiza la lista de vehículos en el panel izquierdo.
 */
function renderizarVehiculos() {
  const lista = document.getElementById('vehiculos-list');
  if (estado.vehiculos.length === 0) {
    lista.innerHTML = '<div class="empty-state">Sin vehículos</div>';
    return;
  }
  lista.innerHTML = estado.vehiculos
    .map(
      (veh) => `
      <div class="item-row">
        <span class="item-name">${escapeHtml(veh.nombre)}</span>
        <button class="btn-delete" onclick="eliminarVehiculo(${veh.id})" title="Eliminar">🗑️</button>
      </div>
    `
    )
    .join('');
}

/**
 * Añade un nuevo vehículo.
 */
async function agregarVehiculo() {
  const input = document.getElementById('vehiculo-nombre');
  const nombre = input.value.trim();
  if (!nombre) {
    mostrarNotificacion('Escriba el nombre del vehículo', 'error');
    return;
  }
  const res = await window.api.addVehiculo(nombre);
  if (res.success) {
    input.value = '';
    await cargarVehiculos();
    mostrarNotificacion(`Vehículo "${nombre}" registrado`, 'exito');
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

/**
 * Elimina un vehículo por ID con opción de deshacer.
 */
async function eliminarVehiculo(id) {
  const vehBorrado = estado.vehiculos.find((v) => v.id === id);

  const res = await window.api.deleteVehiculo(id);
  if (res.success) {
    await cargarVehiculos();
    mostrarNotificacion(`Vehículo "${vehBorrado?.nombre}" eliminado`, 'info', async () => {
      if (vehBorrado) {
        const resVeh = await window.api.addVehiculo(vehBorrado.nombre);
        if (resVeh.success) {
          await cargarVehiculos();
          mostrarNotificacion('Vehículo restaurado', 'exito');
        }
      }
    });
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

// ============================================================
// Generación de tarjetas de tareas
// ============================================================

/**
 * Genera las 6 tarjetas de tareas en el grid.
 */
function generarTarjetasTareas() {
  const grid = document.getElementById('tareas-grid');
  grid.innerHTML = '';

  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    if (!estado.trabajadoresAsignados[slot]) {
      estado.trabajadoresAsignados[slot] = [];
    }

    const card = document.createElement('div');
    card.className = 'tarea-card';
    card.dataset.slot = slot;

    card.innerHTML = `
      <div class="tarea-card-header">
        <h3>Tarea #${slot}</h3>
      </div>

      <div class="tarea-field">
        <label>Clase de trabajo</label>
        <input type="text" class="clase-trabajo" placeholder="Ej: Mantenimiento..." />
      </div>

      <div class="tarea-field">
        <label>Tipo de trabajo</label>
        <input type="text" class="tipo-trabajo" placeholder="Ej: Correctivo..." />
      </div>

      <div class="tarea-field">
        <label>Descripción</label>
        <textarea class="descripcion" placeholder="Describe la tarea..."></textarea>
      </div>

      <div class="vehiculos-group">
        <label>Vehículos (máx. 3)</label>
        <div class="vehiculos-selects">
          <select class="vehiculo-select" data-slot="${slot}" data-veh-index="1">
            <option value="">-- Sin vehículo --</option>
          </select>
          <select class="vehiculo-select" data-slot="${slot}" data-veh-index="2">
            <option value="">-- Sin vehículo --</option>
          </select>
          <select class="vehiculo-select" data-slot="${slot}" data-veh-index="3">
            <option value="">-- Sin vehículo --</option>
          </select>
        </div>
      </div>

      <div class="trabajadores-section">
        <label>Trabajadores asignados</label>
        <div class="trabajadores-add">
          <select class="add-trabajador-select">
            <option value="">-- Seleccionar --</option>
          </select>
          <button class="btn btn-primary btn-small btn-add-trabajador">+ Añadir</button>
        </div>
        <div class="trabajadores-chips" data-slot="${slot}"></div>
      </div>
    `;

    grid.appendChild(card);

    // Evento para añadir trabajador a esta tarea
    const btnAdd = card.querySelector('.btn-add-trabajador');
    btnAdd.addEventListener('click', () => agregarTrabajadorATarea(slot));

    // Eventos de cambio en selects de vehículos para actualizar disponibilidad
    card.querySelectorAll('.vehiculo-select').forEach((sel) => {
      sel.addEventListener('change', () => actualizarSelectsVehiculos());
    });
  }

  // Llenar selects de vehículos y trabajadores
  actualizarSelectsVehiculos();
  actualizarSelectsTrabajadores();
}

// ============================================================
// Selects de vehículos (sin repetir entre tareas)
// ============================================================

/**
 * Recoge todos los vehículos ya asignados en algún select de alguna tarjeta.
 * @returns {Set<number>} IDs de vehículos ya usados
 */
function obtenerVehiculosAsignados() {
  const usados = new Set();
  document.querySelectorAll('.vehiculo-select').forEach((sel) => {
    const val = parseInt(sel.value);
    if (val > 0) usados.add(val);
  });
  return usados;
}

/**
 * Actualiza todos los selects de vehículos.
 * Cada select muestra solo los vehículos no asignados en otros selects.
 */
function actualizarSelectsVehiculos() {
  const selects = document.querySelectorAll('.vehiculo-select');

  selects.forEach((select) => {
    const valorActual = parseInt(select.value) || 0;

    // Recoger vehículos usados en OTROS selects (no en este)
    const usadosEnOtros = new Set();
    selects.forEach((otroSel) => {
      if (otroSel === select) return;
      const val = parseInt(otroSel.value);
      if (val > 0) usadosEnOtros.add(val);
    });

    select.innerHTML = '<option value="">-- Sin vehículo --</option>';
    estado.vehiculos.forEach((veh) => {
      // Mostrar si: no está en otro select, O es el valor actual de este select
      if (!usadosEnOtros.has(veh.id) || veh.id === valorActual) {
        const option = document.createElement('option');
        option.value = veh.id;
        option.textContent = veh.nombre;
        select.appendChild(option);
      }
    });

    // Restaurar valor previo
    if (valorActual > 0) {
      select.value = valorActual;
    }
  });
}

// ============================================================
// Selects de trabajadores (sin duplicados + sin ausentes)
// ============================================================

/**
 * Obtiene IDs de empleados ausentes (baja, vacaciones, descanso) del día.
 * @returns {Set<number>}
 */
function obtenerEmpleadosAusentes() {
  const ausentes = new Set();
  estado.ausencias.forEach((a) => ausentes.add(a.empleado_id));
  return ausentes;
}

/**
 * Actualiza todos los selects de trabajadores en las tarjetas.
 * Filtra los ya asignados Y los ausentes del día.
 */
function actualizarSelectsTrabajadores() {
  // Trabajadores ya asignados en algún slot
  const asignadosGlobal = new Set();
  for (const slot of Object.keys(estado.trabajadoresAsignados)) {
    estado.trabajadoresAsignados[slot].forEach((id) => asignadosGlobal.add(id));
  }

  // Trabajadores ausentes
  const ausentes = obtenerEmpleadosAusentes();

  const selects = document.querySelectorAll('.add-trabajador-select');
  selects.forEach((select) => {
    select.innerHTML = '<option value="">-- Seleccionar --</option>';

    // Agrupar empleados por categoría
    const porCategoria = {};
    estado.empleados.forEach((emp) => {
      // No mostrar asignados ni ausentes
      if (asignadosGlobal.has(emp.id)) return;
      if (ausentes.has(emp.id)) return;
      if (!porCategoria[emp.categoria_nombre]) {
        porCategoria[emp.categoria_nombre] = [];
      }
      porCategoria[emp.categoria_nombre].push(emp);
    });

    // Crear optgroups por categoría
    for (const [catNombre, empleados] of Object.entries(porCategoria)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = catNombre;
      empleados.forEach((emp) => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.nombre;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    }
  });
}

// ============================================================
// Asignación de trabajadores a tareas
// ============================================================

/**
 * Añade un trabajador a una tarea (slot) específica.
 * Valida que no esté duplicado en el mismo día ni ausente.
 * @param {number} slot - Número de slot (1-6)
 */
function agregarTrabajadorATarea(slot) {
  const card = document.querySelector(`.tarea-card[data-slot="${slot}"]`);
  const select = card.querySelector('.add-trabajador-select');
  const empId = parseInt(select.value);

  if (!empId) {
    mostrarNotificacion('Seleccione un trabajador', 'error');
    return;
  }

  // Verificar si está ausente
  if (obtenerEmpleadosAusentes().has(empId)) {
    mostrarNotificacion('Este trabajador está ausente (baja/vacaciones/descanso)', 'error');
    return;
  }

  // Verificar si ya está asignado en CUALQUIER slot del día
  for (const s of Object.keys(estado.trabajadoresAsignados)) {
    if (estado.trabajadoresAsignados[s].includes(empId)) {
      mostrarNotificacion('Este trabajador ya está asignado en otra tarea del día', 'error');
      return;
    }
  }

  // Añadir al slot
  estado.trabajadoresAsignados[slot].push(empId);

  // Actualizar chips y selects
  renderizarChipsTrabajadores(slot);
  actualizarSelectsTrabajadores();

  select.value = '';
}

/**
 * Quita un trabajador de un slot específico.
 */
function quitarTrabajadorDeTarea(slot, empId) {
  estado.trabajadoresAsignados[slot] = estado.trabajadoresAsignados[slot].filter(
    (id) => id !== empId
  );
  renderizarChipsTrabajadores(slot);
  actualizarSelectsTrabajadores();
}

/**
 * Renderiza los chips de trabajadores asignados a un slot.
 */
function renderizarChipsTrabajadores(slot) {
  const container = document.querySelector(`.trabajadores-chips[data-slot="${slot}"]`);
  if (!container) return;

  const ids = estado.trabajadoresAsignados[slot] || [];
  if (ids.length === 0) {
    container.innerHTML = '<span class="empty-state" style="padding:4px;">Sin trabajadores</span>';
    return;
  }

  container.innerHTML = ids
    .map((empId) => {
      const emp = estado.empleados.find((e) => e.id === empId);
      const nombre = emp ? emp.nombre : `ID:${empId}`;
      return `
        <span class="chip">
          ${escapeHtml(nombre)}
          <button class="chip-remove" onclick="quitarTrabajadorDeTarea(${slot}, ${empId})">✕</button>
        </span>
      `;
    })
    .join('');
}

/**
 * Re-renderiza los chips de todos los slots.
 */
function renderizarChipsTodosLosSlots() {
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    renderizarChipsTrabajadores(slot);
  }
  actualizarSelectsTrabajadores();
}

// ============================================================
// Ausencias: baja, vacaciones, descanso
// ============================================================

/**
 * Carga las ausencias del día actual desde la BD.
 */
async function cargarAusencias() {
  const fecha = document.getElementById('fecha-input').value;
  if (!fecha) return;

  const res = await window.api.getAusencias(fecha);
  if (res.success) {
    estado.ausencias = res.data;
    renderizarAusencias();
    actualizarSelectsAusencias();
    // También actualizar selects de trabajadores (para filtrar ausentes)
    actualizarSelectsTrabajadores();
  }
}

/**
 * Renderiza los chips de ausencias en cada sección.
 */
function renderizarAusencias() {
  const tipos = ['baja', 'vacaciones', 'descanso'];

  for (const tipo of tipos) {
    const container = document.getElementById(`chips-${tipo}`);
    const ausenciasTipo = estado.ausencias.filter((a) => a.tipo === tipo);

    if (ausenciasTipo.length === 0) {
      container.innerHTML = '<span class="empty-state" style="padding:4px;">Ninguno</span>';
      continue;
    }

    container.innerHTML = ausenciasTipo
      .map(
        (a) => `
        <span class="chip chip-${tipo}">
          ${escapeHtml(a.empleado_nombre)}
          <button class="chip-remove" onclick="eliminarAusencia(${a.id})">✕</button>
        </span>
      `
      )
      .join('');
  }
}

/**
 * Actualiza los selects de ausencias.
 * Solo muestra empleados no ausentes y no asignados a tareas.
 */
function actualizarSelectsAusencias() {
  const tipos = ['baja', 'vacaciones', 'descanso'];
  const ausentes = obtenerEmpleadosAusentes();

  // Trabajadores ya asignados a tareas
  const asignadosATareas = new Set();
  for (const slot of Object.keys(estado.trabajadoresAsignados)) {
    estado.trabajadoresAsignados[slot].forEach((id) => asignadosATareas.add(id));
  }

  for (const tipo of tipos) {
    const select = document.getElementById(`select-${tipo}`);
    if (!select) continue;

    select.innerHTML = '<option value="">-- Seleccionar trabajador --</option>';

    // Agrupar por categoría
    const porCategoria = {};
    estado.empleados.forEach((emp) => {
      // No mostrar si ya está ausente o asignado a una tarea
      if (ausentes.has(emp.id)) return;
      if (asignadosATareas.has(emp.id)) return;
      if (!porCategoria[emp.categoria_nombre]) {
        porCategoria[emp.categoria_nombre] = [];
      }
      porCategoria[emp.categoria_nombre].push(emp);
    });

    for (const [catNombre, empleados] of Object.entries(porCategoria)) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = catNombre;
      empleados.forEach((emp) => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = emp.nombre;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    }
  }
}

/**
 * Añade un empleado a una lista de ausencia.
 * @param {string} tipo - 'baja', 'vacaciones' o 'descanso'
 */
async function agregarAusencia(tipo) {
  const select = document.getElementById(`select-${tipo}`);
  const empId = parseInt(select.value);
  const fecha = document.getElementById('fecha-input').value;

  if (!empId) {
    mostrarNotificacion('Seleccione un trabajador', 'error');
    return;
  }
  if (!fecha) {
    mostrarNotificacion('Seleccione una fecha', 'error');
    return;
  }

  const res = await window.api.addAusencia(empId, fecha, tipo);
  if (res.success) {
    select.value = '';
    await cargarAusencias();
    // Quitar de tareas si estaba asignado
    for (const slot of Object.keys(estado.trabajadoresAsignados)) {
      estado.trabajadoresAsignados[slot] = estado.trabajadoresAsignados[slot].filter(
        (id) => id !== empId
      );
    }
    renderizarChipsTodosLosSlots();
    const emp = estado.empleados.find((e) => e.id === empId);
    const tipoLabel = tipo === 'baja' ? 'baja' : tipo === 'vacaciones' ? 'vacaciones' : 'descanso';
    mostrarNotificacion(`${emp?.nombre || 'Trabajador'} añadido a ${tipoLabel}`, 'exito');
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

/**
 * Elimina una ausencia por ID.
 */
async function eliminarAusencia(id) {
  const res = await window.api.deleteAusencia(id);
  if (res.success) {
    await cargarAusencias();
    mostrarNotificacion('Ausencia eliminada', 'info');
  } else {
    mostrarNotificacion('Error: ' + res.error, 'error');
  }
}

// ============================================================
// Cargar tareas del día seleccionado
// ============================================================

/**
 * Carga las tareas guardadas de un día y las vuelca en las tarjetas.
 */
async function cargarTareasDia() {
  const fecha = document.getElementById('fecha-input').value;
  if (!fecha) return;

  estado.fechaActual = fecha;

  // Resetear trabajadores asignados
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    estado.trabajadoresAsignados[slot] = [];
  }

  const res = await window.api.getTareasPorFecha(fecha);
  if (!res.success) {
    mostrarNotificacion('Error cargando tareas: ' + res.error, 'error');
    return;
  }

  const tareas = res.data;

  // Limpiar todas las tarjetas primero
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const card = document.querySelector(`.tarea-card[data-slot="${slot}"]`);
    if (!card) continue;
    card.querySelector('.clase-trabajo').value = '';
    card.querySelector('.tipo-trabajo').value = '';
    card.querySelector('.descripcion').value = '';
    card.querySelectorAll('.vehiculo-select').forEach((s) => (s.value = ''));
  }

  // Rellenar con datos guardados
  for (const tarea of tareas) {
    const card = document.querySelector(`.tarea-card[data-slot="${tarea.slot}"]`);
    if (!card) continue;

    card.querySelector('.clase-trabajo').value = tarea.clase_trabajo || '';
    card.querySelector('.tipo-trabajo').value = tarea.tipo_trabajo || '';
    card.querySelector('.descripcion').value = tarea.descripcion || '';

    // Vehículos
    const vehSelects = card.querySelectorAll('.vehiculo-select');
    tarea.vehiculos.forEach((vehId, i) => {
      if (vehSelects[i]) {
        vehSelects[i].value = vehId;
      }
    });

    // Trabajadores
    estado.trabajadoresAsignados[tarea.slot] = [...tarea.trabajadores];
  }

  // Actualizar selects de vehículos (para reflejar los ya asignados)
  actualizarSelectsVehiculos();

  // Renderizar chips de todos los slots
  renderizarChipsTodosLosSlots();
}

// ============================================================
// Guardar tareas y exportar Excel
// ============================================================

/**
 * Recoge los datos de las 6 tarjetas, guarda en BD y exporta Excel.
 */
async function guardarYExportar() {
  const fecha = document.getElementById('fecha-input').value;
  if (!fecha) {
    mostrarNotificacion('Seleccione una fecha antes de guardar', 'error');
    return;
  }

  // Recoger datos de las 6 tarjetas
  const tareas = [];
  for (let slot = 1; slot <= TOTAL_SLOTS; slot++) {
    const card = document.querySelector(`.tarea-card[data-slot="${slot}"]`);
    if (!card) continue;

    const claseT = card.querySelector('.clase-trabajo').value.trim();
    const tipoT = card.querySelector('.tipo-trabajo').value.trim();
    const desc = card.querySelector('.descripcion').value.trim();

    // Recoger vehículos seleccionados
    const vehiculos = [];
    card.querySelectorAll('.vehiculo-select').forEach((select) => {
      const val = parseInt(select.value);
      if (val > 0) vehiculos.push(val);
    });

    // Trabajadores asignados
    const trabajadores = estado.trabajadoresAsignados[slot] || [];

    tareas.push({
      slot,
      clase_trabajo: claseT,
      tipo_trabajo: tipoT,
      descripcion: desc,
      vehiculos,
      trabajadores
    });
  }

  // Guardar en BD (las vacías se filtran en database.js)
  const resSave = await window.api.guardarTareasDia(fecha, tareas);
  if (!resSave.success) {
    mostrarNotificacion('Error al guardar: ' + resSave.error, 'error');
    return;
  }

  // Exportar Excel
  const resExport = await window.api.exportarExcel();
  if (resExport.success) {
    mostrarNotificacion(
      `✅ Día guardado y Excel exportado a:\n${resExport.data.path}`,
      'exito'
    );
  } else {
    mostrarNotificacion(
      `Día guardado, pero error al exportar Excel: ${resExport.error}`,
      'error'
    );
  }
}

// ============================================================
// Notificaciones
// ============================================================

let notificacionTimeout = null;
let deshacerCallback = null;

/**
 * Muestra una notificación flotante con opción de deshacer.
 * @param {string} mensaje - Texto a mostrar
 * @param {string} tipo - 'exito', 'error' o 'info'
 * @param {Function|null} onDeshacer - Callback para deshacer la acción (opcional)
 */
function mostrarNotificacion(mensaje, tipo = 'info', onDeshacer = null) {
  const el = document.getElementById('notificacion');
  const texto = document.getElementById('notificacion-texto');
  const btnDeshacer = document.getElementById('btn-deshacer');

  if (notificacionTimeout) {
    clearTimeout(notificacionTimeout);
  }

  el.classList.remove('exito', 'error', 'info', 'oculto');
  el.classList.add(tipo);
  texto.textContent = mensaje;

  deshacerCallback = onDeshacer;
  if (onDeshacer) {
    btnDeshacer.classList.remove('oculto');
  } else {
    btnDeshacer.classList.add('oculto');
  }

  const duracion = onDeshacer ? 6000 : 4000;
  notificacionTimeout = setTimeout(() => {
    el.classList.add('oculto');
    btnDeshacer.classList.add('oculto');
    deshacerCallback = null;
  }, duracion);
}

// Registrar evento del botón deshacer una sola vez
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-deshacer').addEventListener('click', async () => {
    if (deshacerCallback) {
      await deshacerCallback();
      deshacerCallback = null;
      document.getElementById('btn-deshacer').classList.add('oculto');
      document.getElementById('notificacion').classList.add('oculto');
    }
  });
});

// ============================================================
// Utilidades
// ============================================================

/**
 * Escapa caracteres HTML para prevenir XSS.
 * @param {string} text - Texto a escapar
 * @returns {string} Texto con entidades HTML escapadas
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Exponer funciones necesarias al ámbito global para eventos inline
window.eliminarCategoria = eliminarCategoria;
window.eliminarEmpleado = eliminarEmpleado;
window.eliminarVehiculo = eliminarVehiculo;
window.quitarTrabajadorDeTarea = quitarTrabajadorDeTarea;
window.toggleSeccion = toggleSeccion;
window.agregarAusencia = agregarAusencia;
window.eliminarAusencia = eliminarAusencia;
