// ============================================================
// main.js - Proceso principal de Electron
// Crea la ventana, registra handlers IPC y carga la BD
// ============================================================

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const database = require('./database');

let mainWindow = null;

// ============================================================
// Creación de la ventana principal
// ============================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Planificador de Tareas',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  // Quitar menú por defecto en producción
  if (app.isPackaged) {
    mainWindow.setMenu(null);
  }
}

// ============================================================
// Inicialización de la aplicación
// ============================================================

app.whenReady().then(async () => {
  // Inicializar base de datos antes de crear la ventana
  try {
    await database.initDatabase(app.getPath('userData'));
    console.log('Base de datos inicializada correctamente');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }

  createWindow();

  // macOS: recrear ventana si se hace clic en el dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Cerrar la app cuando se cierran todas las ventanas (excepto macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ============================================================
// Handlers IPC - Categorías
// ============================================================

ipcMain.handle('get-categories', async () => {
  try {
    return { success: true, data: database.getCategorias() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-category', async (_event, nombre) => {
  try {
    const result = database.addCategoria(nombre);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-category', async (_event, id) => {
  try {
    database.deleteCategoria(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Handlers IPC - Empleados
// ============================================================

ipcMain.handle('get-employees', async () => {
  try {
    return { success: true, data: database.getEmpleados() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-employee', async (_event, { nombre, categoriaId }) => {
  try {
    const result = database.addEmpleado(nombre, categoriaId);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-employee', async (_event, id) => {
  try {
    database.deleteEmpleado(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Handlers IPC - Vehículos
// ============================================================

ipcMain.handle('get-vehicles', async () => {
  try {
    return { success: true, data: database.getVehiculos() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-vehicle', async (_event, nombre) => {
  try {
    const result = database.addVehiculo(nombre);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-vehicle', async (_event, id) => {
  try {
    database.deleteVehiculo(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Handlers IPC - Tareas
// ============================================================

ipcMain.handle('get-tasks-by-date', async (_event, fecha) => {
  try {
    return { success: true, data: database.getTareasPorFecha(fecha) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-day-tasks', async (_event, { fecha, tareas }) => {
  try {
    database.guardarTareasDia(fecha, tareas);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Handler IPC - Exportación Excel
// ============================================================

ipcMain.handle('export-excel', async () => {
  try {
    const documentsPath = app.getPath('documents');
    const result = database.exportarExcel(documentsPath);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================================
// Handlers IPC - Ausencias (baja, vacaciones, descanso)
// ============================================================

ipcMain.handle('get-ausencias', async (_event, fecha) => {
  try {
    return { success: true, data: database.getAusencias(fecha) };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('add-ausencia', async (_event, { empleadoId, fecha, tipo }) => {
  try {
    const result = database.addAusencia(empleadoId, fecha, tipo);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-ausencia', async (_event, id) => {
  try {
    database.deleteAusencia(id);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
