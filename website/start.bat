@echo off
title KAITO Verse Server
cd /d "%~dp0"
echo.
echo  KAITO Verse - 本地服务器
echo  请勿使用 Cursor/VS Code 的 Show Preview，请用浏览器打开下方地址
echo.
python serve.py
pause
