#!/usr/bin/env sh
# Liga a mesa no Linux (e macOS). Uso: ./iniciar.sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js nao encontrado. Instale a versao 18 ou mais nova (ex.: sudo apt install nodejs)."
  exit 1
fi

exec node server.js
