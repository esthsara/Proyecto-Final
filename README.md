# Proyecto-Final — Análisis Numérico (Flask)

Proyecto de ejemplo con Flask que contiene herramientas para:

- Encuentrar puntos de equilibrio (Bisección / Newton-Raphson)
- Ajuste de modelos (regresión lineal / polinómica)
- Asignación de presupuesto (proporcional / resolución de sistemas)

Este README explica cómo ejecutar localmente y desplegar en plataformas que soportan Python (Render, Heroku, PythonAnywhere). Netlify no sirve para ejecutar aplicaciones Python con servidor.

---
## Requisitos

- Python 3.11 (recomendado)
- Virtualenv (opcional pero recomendado)
- Git y cuenta en GitHub si quieres desplegar desde repo

El archivo `requirements.txt` ya contiene las dependencias necesarias:

- `Flask`
- `numpy`
- `gunicorn` (para producción)

---
## Ejecutar localmente (Windows PowerShell)

1. Crear y activar un entorno virtual (si no lo tienes):

```powershell
python -m venv venv
& .\venv\Scripts\Activate.ps1
```

2. Instalar dependencias:

```powershell
pip install -r requirements.txt
```

3. Ejecutar la app en modo desarrollo:

```powershell
python app.py
```

La aplicación se servirá por defecto en `http://127.0.0.1:5000`.

4. (Opcional) Ejecutar con Gunicorn para probar como en producción (requiere `gunicorn`):

```powershell
# En PowerShell, usar el ejecutable de venv
& .\venv\Scripts\gunicorn.exe app:app --bind 0.0.0.0:8000
```

---
## Despliegue en Render (recomendado, muy sencillo)

Render tiene soporte directo para aplicaciones web en Python. Pasos resumidos:

1. Crear cuenta en https://render.com y conectar tu repositorio de GitHub.
2. Crear un nuevo **Web Service** y seleccionar el repositorio.
3. Render detectará `requirements.txt` y usará `gunicorn` por defecto si encuentra `Procfile` o `app.py`.

Configuración recomendada en Render:
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT`
- Environment: `Python 3.11`

Render proveerá una URL pública donde verás tu app.

---
## Despliegue en Heroku

Heroku también admite apps Python. Pasos:

1. Asegúrate de tener `requirements.txt` y `Procfile` (se incluye en este repo):

`Procfile`:
```
web: gunicorn app:app
```

2. Crear app en Heroku y conectar tu repo, o desplegar por CLI:

```powershell
# instalar heroku cli y login
heroku login
# crear app
heroku create nombre-tu-app
# push
git push heroku main
```

Heroku ejecutará `web: gunicorn app:app` según el `Procfile`.

---
## Despliegue en PythonAnywhere

PythonAnywhere es ideal para proyectos pequeños:

1. Crear cuenta en https://www.pythonanywhere.com
2. Subir el repo (clonar desde GitHub o subir archivos)
3. Crear una Web App (choose Manual configuration -> Flask)
4. Apuntar WSGI file a `app.app` y asegurarte de instalar dependencias en la consola de PythonAnywhere:

```bash
pip install -r requirements.txt --user
```

