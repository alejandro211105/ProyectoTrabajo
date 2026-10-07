// ============================================================
// database.js - Capa de acceso a datos con sql.js (SQLite)
// Gestiona todas las operaciones CRUD y persistencia a disco
// ============================================================

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let db = null;
let dbPath = '';

// ============================================================
// Inicialización de la base de datos
// ============================================================

/**
 * Inicializa la base de datos SQLite.
 * Carga desde disco si existe, o crea una nueva.
 * @param {string} userDataPath - Ruta de datos de la app (app.getPath('userData'))
 */
async function initDatabase(userDataPath) {
  dbPath = path.join(userDataPath, 'planificador.db');

  // Localizar el archivo wasm de sql.js
  const wasmPath = path.join(
    __dirname,
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  );

  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  // Cargar base de datos existente o crear nueva
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // Crear tablas si no existen
  crearTablas();

  // Guardar estado inicial a disco
  guardarADisco();

  return db;
}

/**
 * Crea las tablas del esquema si no existen.
 */
function crearTablas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS vehiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tareas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 6),
      clase_trabajo TEXT NOT NULL DEFAULT '',
      tipo_trabajo TEXT NOT NULL DEFAULT '',
      descripcion TEXT NOT NULL DEFAULT ''
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tarea_vehiculos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tarea_id INTEGER NOT NULL,
      vehiculo_id INTEGER NOT NULL,
      FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE,
      FOREIGN KEY (vehiculo_id) REFERENCES vehiculos(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tarea_trabajadores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tarea_id INTEGER NOT NULL,
      empleado_id INTEGER NOT NULL,
      FOREIGN KEY (tarea_id) REFERENCES tareas(id) ON DELETE CASCADE,
      FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE
    )
  `);

  // Tabla de ausencias: baja, vacaciones, descanso
  db.run(`
    CREATE TABLE IF NOT EXISTS ausencias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('baja', 'vacaciones', 'descanso')),
      FOREIGN KEY (empleado_id) REFERENCES empleados(id) ON DELETE CASCADE
    )
  `);
}

/**
 * Persiste la base de datos en memoria a disco.
 */
function guardarADisco() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ============================================================
// CRUD - Categorías
// ============================================================

/**
 * Obtiene todas las categorías.
 * @returns {Array<{id: number, nombre: string}>}
 */
function getCategorias() {
  const stmt = db.prepare('SELECT id, nombre FROM categorias ORDER BY nombre');
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Añade una nueva categoría.
 * @param {string} nombre - Nombre de la categoría
 * @returns {{id: number, nombre: string}}
 */
function addCategoria(nombre) {
  if (!nombre || nombre.trim() === '') {
    throw new Error('El nombre de la categoría no puede estar vacío');
  }
  db.run('INSERT INTO categorias (nombre) VALUES (?)', [nombre.trim()]);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  guardarADisco();
  return { id, nombre: nombre.trim() };
}

/**
 * Elimina una categoría y sus empleados asociados.
 * @param {number} id - ID de la categoría
 */
function deleteCategoria(id) {
  // Primero eliminar empleados de esa categoría
  db.run('DELETE FROM empleados WHERE categoria_id = ?', [id]);
  db.run('DELETE FROM categorias WHERE id = ?', [id]);
  guardarADisco();
  return { success: true };
}

// ============================================================
// CRUD - Empleados
// ============================================================

/**
 * Obtiene todos los empleados con el nombre de su categoría.
 * @returns {Array<{id: number, nombre: string, categoria_id: number, categoria_nombre: string}>}
 */
function getEmpleados() {
  const stmt = db.prepare(`
    SELECT e.id, e.nombre, e.categoria_id, c.nombre as categoria_nombre
    FROM empleados e
    JOIN categorias c ON e.categoria_id = c.id
    ORDER BY c.nombre, e.nombre
  `);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Añade un nuevo empleado a una categoría.
 * @param {string} nombre - Nombre del empleado
 * @param {number} categoriaId - ID de la categoría
 * @returns {{id: number, nombre: string, categoria_id: number}}
 */
function addEmpleado(nombre, categoriaId) {
  if (!nombre || nombre.trim() === '') {
    throw new Error('El nombre del empleado no puede estar vacío');
  }
  if (!categoriaId) {
    throw new Error('Debe seleccionar una categoría');
  }
  db.run('INSERT INTO empleados (nombre, categoria_id) VALUES (?, ?)', [
    nombre.trim(),
    categoriaId
  ]);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  guardarADisco();
  return { id, nombre: nombre.trim(), categoria_id: categoriaId };
}

/**
 * Elimina un empleado.
 * @param {number} id - ID del empleado
 */
function deleteEmpleado(id) {
  // Eliminar asignaciones de tareas del empleado
  db.run('DELETE FROM tarea_trabajadores WHERE empleado_id = ?', [id]);
  db.run('DELETE FROM empleados WHERE id = ?', [id]);
  guardarADisco();
  return { success: true };
}

// ============================================================
// CRUD - Vehículos
// ============================================================

/**
 * Obtiene todos los vehículos.
 * @returns {Array<{id: number, nombre: string}>}
 */
function getVehiculos() {
  const stmt = db.prepare('SELECT id, nombre FROM vehiculos ORDER BY nombre');
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Añade un nuevo vehículo.
 * @param {string} nombre - Nombre/identificador del vehículo
 * @returns {{id: number, nombre: string}}
 */
function addVehiculo(nombre) {
  if (!nombre || nombre.trim() === '') {
    throw new Error('El nombre del vehículo no puede estar vacío');
  }
  db.run('INSERT INTO vehiculos (nombre) VALUES (?)', [nombre.trim()]);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  guardarADisco();
  return { id, nombre: nombre.trim() };
}

/**
 * Elimina un vehículo.
 * @param {number} id - ID del vehículo
 */
function deleteVehiculo(id) {
  // Eliminar asignaciones de vehículo en tareas
  db.run('DELETE FROM tarea_vehiculos WHERE vehiculo_id = ?', [id]);
  db.run('DELETE FROM vehiculos WHERE id = ?', [id]);
  guardarADisco();
  return { success: true };
}

// ============================================================
// Tareas - Guardar y Recuperar
// ============================================================

/**
 * Obtiene las tareas de un día específico con sus vehículos y trabajadores.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Array} Tareas con vehículos y trabajadores asociados
 */
function getTareasPorFecha(fecha) {
  const tareas = [];

  // Obtener tareas del día
  const stmtTareas = db.prepare(
    'SELECT id, fecha, slot, clase_trabajo, tipo_trabajo, descripcion FROM tareas WHERE fecha = ? ORDER BY slot'
  );
  stmtTareas.bind([fecha]);

  while (stmtTareas.step()) {
    const tarea = stmtTareas.getAsObject();

    // Obtener vehículos de la tarea
    const stmtVeh = db.prepare(
      'SELECT vehiculo_id FROM tarea_vehiculos WHERE tarea_id = ?'
    );
    stmtVeh.bind([tarea.id]);
    const vehiculos = [];
    while (stmtVeh.step()) {
      vehiculos.push(stmtVeh.getAsObject().vehiculo_id);
    }
    stmtVeh.free();

    // Obtener trabajadores de la tarea
    const stmtTrab = db.prepare(
      'SELECT empleado_id FROM tarea_trabajadores WHERE tarea_id = ?'
    );
    stmtTrab.bind([tarea.id]);
    const trabajadores = [];
    while (stmtTrab.step()) {
      trabajadores.push(stmtTrab.getAsObject().empleado_id);
    }
    stmtTrab.free();

    tareas.push({
      ...tarea,
      vehiculos,
      trabajadores
    });
  }
  stmtTareas.free();

  return tareas;
}

/**
 * Guarda las tareas de un día completo (solo las que tienen contenido).
 * Elimina tareas previas del día y las reemplaza.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @param {Array} tareas - Array de tareas con sus datos
 */
function guardarTareasDia(fecha, tareas) {
  if (!fecha) {
    throw new Error('La fecha es obligatoria');
  }

  // Filtrar tareas vacías: solo guardar las que tienen algún dato
  const tareasConDatos = tareas.filter((t) => {
    const tieneTexto = (t.clase_trabajo && t.clase_trabajo.trim() !== '') ||
                       (t.tipo_trabajo && t.tipo_trabajo.trim() !== '') ||
                       (t.descripcion && t.descripcion.trim() !== '');
    const tieneVehiculos = t.vehiculos && t.vehiculos.filter(v => v && v > 0).length > 0;
    const tieneTrabajadores = t.trabajadores && t.trabajadores.length > 0;
    return tieneTexto || tieneVehiculos || tieneTrabajadores;
  });

  // Obtener IDs de tareas existentes para eliminar relaciones
  const tareasExistentes = db.prepare(
    'SELECT id FROM tareas WHERE fecha = ?'
  );
  tareasExistentes.bind([fecha]);
  const idsExistentes = [];
  while (tareasExistentes.step()) {
    idsExistentes.push(tareasExistentes.getAsObject().id);
  }
  tareasExistentes.free();

  // Eliminar relaciones y tareas existentes del día
  for (const id of idsExistentes) {
    db.run('DELETE FROM tarea_vehiculos WHERE tarea_id = ?', [id]);
    db.run('DELETE FROM tarea_trabajadores WHERE tarea_id = ?', [id]);
  }
  db.run('DELETE FROM tareas WHERE fecha = ?', [fecha]);

  // Validar que no haya trabajadores duplicados en el día
  const todosLosTrabajadores = [];
  for (const tarea of tareasConDatos) {
    if (tarea.trabajadores && tarea.trabajadores.length > 0) {
      for (const empId of tarea.trabajadores) {
        if (todosLosTrabajadores.includes(empId)) {
          throw new Error(
            `El trabajador con ID ${empId} está asignado a más de una tarea en el mismo día`
          );
        }
        todosLosTrabajadores.push(empId);
      }
    }
  }

  // Insertar solo tareas con contenido
  for (const tarea of tareasConDatos) {
    const slot = tarea.slot;
    const claseT = tarea.clase_trabajo || '';
    const tipoT = tarea.tipo_trabajo || '';
    const desc = tarea.descripcion || '';

    db.run(
      'INSERT INTO tareas (fecha, slot, clase_trabajo, tipo_trabajo, descripcion) VALUES (?, ?, ?, ?, ?)',
      [fecha, slot, claseT, tipoT, desc]
    );
    const tareaId = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];

    // Insertar vehículos de la tarea (máximo 3)
    if (tarea.vehiculos && tarea.vehiculos.length > 0) {
      const vehiculosValidos = tarea.vehiculos.filter((v) => v && v > 0).slice(0, 3);
      for (const vehId of vehiculosValidos) {
        db.run(
          'INSERT INTO tarea_vehiculos (tarea_id, vehiculo_id) VALUES (?, ?)',
          [tareaId, vehId]
        );
      }
    }

    // Insertar trabajadores de la tarea
    if (tarea.trabajadores && tarea.trabajadores.length > 0) {
      for (const empId of tarea.trabajadores) {
        if (empId && empId > 0) {
          db.run(
            'INSERT INTO tarea_trabajadores (tarea_id, empleado_id) VALUES (?, ?)',
            [tareaId, empId]
          );
        }
      }
    }
  }

  guardarADisco();
  return { success: true };
}

// ============================================================
// Exportación a Excel
// ============================================================

/**
 * Exporta todas las tareas registradas a un archivo Excel acumulativo.
 * @param {string} documentsPath - Ruta a la carpeta Documentos
 * @returns {{path: string, message: string}}
 */
function exportarExcel(documentsPath) {
  const XLSX = require('xlsx');

  // Crear directorio de exportación
  const exportDir = path.join(documentsPath, 'Distribucion_Tareas');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  const excelPath = path.join(exportDir, 'registro_tareas.xlsx');

  // Obtener todas las tareas con sus relaciones
  const stmtTareas = db.prepare(`
    SELECT id, fecha, slot, clase_trabajo, tipo_trabajo, descripcion
    FROM tareas
    ORDER BY fecha DESC, slot ASC
  `);

  const filas = [];

  while (stmtTareas.step()) {
    const tarea = stmtTareas.getAsObject();

    // Obtener nombres de vehículos
    const stmtVeh = db.prepare(`
      SELECT v.nombre
      FROM tarea_vehiculos tv
      JOIN vehiculos v ON tv.vehiculo_id = v.id
      WHERE tv.tarea_id = ?
    `);
    stmtVeh.bind([tarea.id]);
    const vehiculos = [];
    while (stmtVeh.step()) {
      vehiculos.push(stmtVeh.getAsObject().nombre);
    }
    stmtVeh.free();

    // Obtener nombres de trabajadores con categoría
    const stmtTrab = db.prepare(`
      SELECT e.nombre, c.nombre as categoria
      FROM tarea_trabajadores tt
      JOIN empleados e ON tt.empleado_id = e.id
      JOIN categorias c ON e.categoria_id = c.id
      WHERE tt.tarea_id = ?
    `);
    stmtTrab.bind([tarea.id]);
    const trabajadores = [];
    while (stmtTrab.step()) {
      const t = stmtTrab.getAsObject();
      trabajadores.push(`${t.nombre} (${t.categoria})`);
    }
    stmtTrab.free();

    filas.push({
      Fecha: tarea.fecha,
      Slot: tarea.slot,
      'Clase de Trabajo': tarea.clase_trabajo,
      'Tipo de Trabajo': tarea.tipo_trabajo,
      Descripción: tarea.descripcion,
      'Vehículo 1': vehiculos[0] || '',
      'Vehículo 2': vehiculos[1] || '',
      'Vehículo 3': vehiculos[2] || '',
      Trabajadores: trabajadores.join(', ')
    });
  }
  stmtTareas.free();

  // Crear libro Excel
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(filas);

  // Ajustar ancho de columnas
  ws['!cols'] = [
    { wch: 12 }, // Fecha
    { wch: 6 },  // Slot
    { wch: 20 }, // Clase de Trabajo
    { wch: 20 }, // Tipo de Trabajo
    { wch: 40 }, // Descripción
    { wch: 15 }, // Vehículo 1
    { wch: 15 }, // Vehículo 2
    { wch: 15 }, // Vehículo 3
    { wch: 50 }  // Trabajadores
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Tareas');
  XLSX.writeFile(wb, excelPath);

  return {
    path: excelPath,
    message: `Excel exportado correctamente a: ${excelPath}`
  };
}

// ============================================================
// CRUD - Ausencias (baja, vacaciones, descanso)
// ============================================================

/**
 * Obtiene las ausencias de un día específico.
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Array<{id: number, empleado_id: number, fecha: string, tipo: string, empleado_nombre: string}>}
 */
function getAusencias(fecha) {
  const stmt = db.prepare(`
    SELECT a.id, a.empleado_id, a.fecha, a.tipo, e.nombre as empleado_nombre
    FROM ausencias a
    JOIN empleados e ON a.empleado_id = e.id
    WHERE a.fecha = ?
    ORDER BY a.tipo, e.nombre
  `);
  stmt.bind([fecha]);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * Añade una ausencia para un empleado en una fecha.
 * @param {number} empleadoId - ID del empleado
 * @param {string} fecha - Fecha
 * @param {string} tipo - 'baja', 'vacaciones' o 'descanso'
 */
function addAusencia(empleadoId, fecha, tipo) {
  if (!empleadoId || !fecha || !tipo) {
    throw new Error('Empleado, fecha y tipo son obligatorios');
  }
  // Verificar que no exista ya una ausencia para ese empleado en esa fecha
  const check = db.prepare(
    'SELECT COUNT(*) as cnt FROM ausencias WHERE empleado_id = ? AND fecha = ?'
  );
  check.bind([empleadoId, fecha]);
  check.step();
  const existe = check.getAsObject().cnt > 0;
  check.free();
  if (existe) {
    throw new Error('Este trabajador ya tiene una ausencia registrada en este día');
  }
  db.run('INSERT INTO ausencias (empleado_id, fecha, tipo) VALUES (?, ?, ?)', [
    empleadoId, fecha, tipo
  ]);
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  guardarADisco();
  return { id, empleado_id: empleadoId, fecha, tipo };
}

/**
 * Elimina una ausencia por ID.
 * @param {number} id - ID de la ausencia
 */
function deleteAusencia(id) {
  db.run('DELETE FROM ausencias WHERE id = ?', [id]);
  guardarADisco();
  return { success: true };
}

// ============================================================
// Exportar módulo
// ============================================================

module.exports = {
  initDatabase,
  getCategorias,
  addCategoria,
  deleteCategoria,
  getEmpleados,
  addEmpleado,
  deleteEmpleado,
  getVehiculos,
  addVehiculo,
  deleteVehiculo,
  getTareasPorFecha,
  guardarTareasDia,
  exportarExcel,
  getAusencias,
  addAusencia,
  deleteAusencia
};
