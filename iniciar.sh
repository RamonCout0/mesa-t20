#!/usr/bin/env sh
# Liga a mesa no Linux (e macOS). Uso: ./iniciar.sh
# Na primeira vez instala as dependencias (precisa de internet); depois funciona offline.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale a versao 22.18 ou mais nova (https://nodejs.org)."
  exit 1
fi
if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)"; then
  echo "Seu Node.js e $(node -v). A mesa precisa da versao 22.18 ou mais nova (https://nodejs.org)."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Instalando dependencias (so na primeira vez)..."
  npm install || exit 1
fi
echo "Preparando as telas..."
npm run build --silent || exit 1

exec node src/server/main.ts
