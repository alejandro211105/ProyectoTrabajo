// ============================================================
// preload.js - Bridge seguro entre procesos Electron
// Expone API al renderer mediante contextBridge
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

// API expuesta al frontend de forma segura
contextBridge.exposeInMainWorld('api', {
  // --- Categorías ---
  getCategorias: () => ipcRenderer.invoke('get-categories'),
  addCategoria: (nombre) => ipcRenderer.invoke('add-category', nombre),
  deleteCategoria: (id) => ipcRenderer.invoke('delete-category', id),

  // --- Empleados ---
  getEmpleados: () => ipcRenderer.invoke('get-employees'),
  addEmpleado: (nombre, categoriaId) =>
    ipcRenderer.invoke('add-employee', { nombre, categoriaId }),
  deleteEmpleado: (id) => ipcRenderer.invoke('delete-employee', id),

  // --- Vehículos ---
  getVehiculos: () => ipcRenderer.invoke('get-vehicles'),
  addVehiculo: (nombre) => ipcRenderer.invoke('add-vehicle', nombre),
  deleteVehiculo: (id) => ipcRenderer.invoke('delete-vehicle', id),

  // --- Tareas ---
  getTareasPorFecha: (fecha) =>
    ipcRenderer.invoke('get-tasks-by-date', fecha),
  guardarTareasDia: (fecha, tareas) =>
    ipcRenderer.invoke('save-day-tasks', { fecha, tareas }),

  // --- Exportación ---
  exportarExcel: () => ipcRenderer.invoke('export-excel'),

  // --- Ausencias (baja, vacaciones, descanso) ---
  getAusencias: (fecha) => ipcRenderer.invoke('get-ausencias', fecha),
  addAusencia: (empleadoId, fecha, tipo) =>
    ipcRenderer.invoke('add-ausencia', { empleadoId, fecha, tipo }),
  deleteAusencia: (id) => ipcRenderer.invoke('delete-ausencia', id)
});
