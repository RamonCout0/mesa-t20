@echo off
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js nao encontrado. Instale a versao 22.18 ou mais nova: https://nodejs.org & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)" || (echo A mesa precisa do Node.js 22.18 ou mais novo: https://nodejs.org & pause & exit /b 1)
if not exist node_modules (
  echo Instalando dependencias, so na primeira vez...
  call npm install || (pause & exit /b 1)
)
echo Preparando as telas...
call npm run build --silent || (pause & exit /b 1)
node src\server\main.ts
pause
