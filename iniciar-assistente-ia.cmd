@echo off
setlocal
chcp 65001 >nul
title BemTeVi - Conexao com assistente de IA
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Nao foi possivel iniciar a conexao.
  echo O Node.js precisa estar instalado neste computador.
  echo Peca ajuda a pessoa responsavel pela instalacao do BemTeVi.
  echo.
  pause
  exit /b 1
)

echo.
echo BemTeVi - Conexao com assistente de IA
echo Mantenha esta janela aberta enquanto usar o assistente.
echo.
node scripts\agent-bridge\server.mjs

if errorlevel 1 (
  echo.
  echo A conexao foi encerrada com um erro.
  echo Peca ajuda a pessoa responsavel pela instalacao do BemTeVi.
  echo.
  pause
)
