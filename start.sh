#!/bin/bash
# Script de inicio para Railway Frontend

echo "=========================================="
echo "=== Starting Wellbyn Notes Frontend ==="
echo "=========================================="
echo "Timestamp: $(date)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Working directory: $(pwd)"
echo ""

# Verificar que dist existe
if [ ! -d "dist" ]; then
    echo "ERROR: dist directory not found. Running build..."
    npm run build
fi

# Log de variables de entorno importantes
echo "=== Environment Variables ==="
echo "PORT: ${PORT:-NOT_SET}"
echo "VITE_API_URL: ${VITE_API_URL:-NOT_SET}"
echo ""

# Verificar que PORT esté definido, usar 3000 como fallback
PORT=${PORT:-3000}
export PORT

echo "=== Starting Server ==="
echo "Using PORT: $PORT"
echo "Serving from: dist/"
echo "=========================================="
echo ""

# Iniciar el servidor
exec serve -s dist -l $PORT
