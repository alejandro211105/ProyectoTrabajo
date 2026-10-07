#!/bin/bash
# ============================================================
# install-linux.sh - Script de instalación para Ubuntu/Debian
# Instala dependencias, configura permisos y crea acceso directo
# ============================================================

set -e

# Colores para la salida
VERDE='\033[0;32m'
ROJO='\033[0;31m'
AMARILLO='\033[1;33m'
AZUL='\033[0;34m'
NC='\033[0m' # Sin color

echo -e "${AZUL}============================================${NC}"
echo -e "${AZUL}  Instalador - Planificador de Tareas       ${NC}"
echo -e "${AZUL}============================================${NC}"
echo ""

# Directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ============================================================
# Verificar que estamos en Linux
# ============================================================
if [[ "$(uname)" != "Linux" ]]; then
  echo -e "${ROJO}Error: Este script solo funciona en Linux.${NC}"
  exit 1
fi

# ============================================================
# Verificar / instalar Node.js
# ============================================================
echo -e "${AMARILLO}[1/5] Verificando Node.js...${NC}"

if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "${VERDE}  ✓ Node.js ${NODE_VERSION} encontrado${NC}"
else
  echo -e "${AMARILLO}  Node.js no encontrado. Instalando...${NC}"

  # Instalar Node.js 20.x desde NodeSource
  if command -v curl &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  elif command -v wget &> /dev/null; then
    wget -qO- https://deb.nodesource.com/setup_20.x | sudo -E bash -
  else
    echo -e "${ROJO}  Error: Se necesita curl o wget para instalar Node.js${NC}"
    echo -e "${AMARILLO}  Ejecute: sudo apt install curl${NC}"
    exit 1
  fi

  sudo apt-get install -y nodejs
  echo -e "${VERDE}  ✓ Node.js $(node --version) instalado${NC}"
fi

# ============================================================
# Verificar npm
# ============================================================
if ! command -v npm &> /dev/null; then
  echo -e "${ROJO}  Error: npm no encontrado. Reinstale Node.js${NC}"
  exit 1
fi
echo -e "${VERDE}  ✓ npm $(npm --version) disponible${NC}"

# ============================================================
# Instalar dependencias del sistema para Electron
# ============================================================
echo -e "${AMARILLO}[2/5] Instalando dependencias del sistema...${NC}"

sudo apt-get update -qq
sudo apt-get install -y -qq \
  libgtk-3-0 \
  libnotify4 \
  libnss3 \
  libxss1 \
  libxtst6 \
  xdg-utils \
  libatspi2.0-0 \
  libuuid1 \
  libsecret-1-0 \
  libgbm1 \
  libasound2 2>/dev/null || true

echo -e "${VERDE}  ✓ Dependencias del sistema instaladas${NC}"

# ============================================================
# Instalar dependencias de Node.js
# ============================================================
echo -e "${AMARILLO}[3/5] Instalando dependencias de Node.js...${NC}"

cd "$SCRIPT_DIR"
npm install

echo -e "${VERDE}  ✓ Dependencias de Node.js instaladas${NC}"

# ============================================================
# Configurar permisos de chrome-sandbox para Electron
# ============================================================
echo -e "${AMARILLO}[4/5] Configurando permisos de Electron sandbox...${NC}"

SANDBOX_PATH="$SCRIPT_DIR/node_modules/electron/dist/chrome-sandbox"

if [ -f "$SANDBOX_PATH" ]; then
  sudo chown root:root "$SANDBOX_PATH"
  sudo chmod 4755 "$SANDBOX_PATH"
  echo -e "${VERDE}  ✓ Permisos de chrome-sandbox configurados${NC}"
else
  echo -e "${AMARILLO}  ⚠ chrome-sandbox no encontrado (se usará --no-sandbox)${NC}"
fi

# ============================================================
# Crear acceso directo en el escritorio
# ============================================================
echo -e "${AMARILLO}[5/5] Creando acceso directo...${NC}"

DESKTOP_DIR="$HOME/Desktop"
if [ ! -d "$DESKTOP_DIR" ]; then
  DESKTOP_DIR="$HOME/Escritorio"
fi
if [ ! -d "$DESKTOP_DIR" ]; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
fi

# Crear directorio si no existe
mkdir -p "$DESKTOP_DIR" 2>/dev/null || true

# Crear archivo .desktop
DESKTOP_FILE="$DESKTOP_DIR/planificador-tareas.desktop"
cat > "$DESKTOP_FILE" << EOL
[Desktop Entry]
Type=Application
Name=Planificador de Tareas
Comment=Planificador diario de tareas con gestión de trabajadores
Exec=bash -c "cd '${SCRIPT_DIR}' && npm start"
Terminal=false
Categories=Office;
StartupNotify=true
EOL

chmod +x "$DESKTOP_FILE"

# También instalar en aplicaciones del sistema
APPS_DIR="$HOME/.local/share/applications"
mkdir -p "$APPS_DIR"
cp "$DESKTOP_FILE" "$APPS_DIR/"

echo -e "${VERDE}  ✓ Acceso directo creado${NC}"

# ============================================================
# Crear directorio de exportación
# ============================================================
EXPORT_DIR="$HOME/Documents/Distribucion_Tareas"
if [ ! -d "$EXPORT_DIR" ]; then
  EXPORT_DIR="$HOME/Documentos/Distribucion_Tareas"
fi
mkdir -p "$EXPORT_DIR" 2>/dev/null || mkdir -p "$HOME/Documents/Distribucion_Tareas" 2>/dev/null || true

# ============================================================
# Finalización
# ============================================================
echo ""
echo -e "${AZUL}============================================${NC}"
echo -e "${VERDE}  ✓ Instalación completada exitosamente${NC}"
echo -e "${AZUL}============================================${NC}"
echo ""
echo -e "  Para ejecutar la aplicación:"
echo -e "    ${AZUL}cd ${SCRIPT_DIR}${NC}"
echo -e "    ${AZUL}npm start${NC}"
echo ""
echo -e "  O use el acceso directo en el escritorio."
echo ""

# Preguntar si quiere ejecutar ahora
read -p "¿Desea ejecutar la aplicación ahora? (s/n): " EJECUTAR
if [[ "$EJECUTAR" =~ ^[sS]$ ]]; then
  echo -e "${AMARILLO}Iniciando aplicación...${NC}"
  cd "$SCRIPT_DIR"
  npm start &
  echo -e "${VERDE}Aplicación iniciada.${NC}"
fi
