@echo off
title ERP PEPS - Inicializador
echo ===================================================
echo   SISTEMA ERP PEPS - INICIALIZANDO SERVIDORES
echo ===================================================
echo.

echo [1/2] Iniciando Servidor API (Backend FastAPI na porta 8000)...
start "API Backend (FastAPI)" cmd /k "cd /d C:\projetos GitHub\erp_peps\ERP-PDV\backend && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo [2/2] Iniciando Servidor Web (Frontend Next.js na porta 3000)...
start "Web Frontend (Next.js)" cmd /k "cd /d C:\projetos GitHub\erp_peps\ERP-PDV\frontend && npm run dev"

echo.
echo ===================================================
echo   Servidores iniciados com sucesso!
echo   API: http://localhost:8000/docs (Swagger UI)
echo   ERP: http://localhost:3000 (Next.js App)
echo ===================================================
echo.
pause
