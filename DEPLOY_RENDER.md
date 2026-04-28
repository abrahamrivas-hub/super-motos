# Desplegar en Render

## Pasos:

### 1. Sube tu código a GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

### 2. Ve a Render

1. Ve a [render.com](https://render.com)
2. Regístrate o inicia sesión
3. Click en **New +** → **Web Service**

### 3. Conecta tu repositorio

1. Conecta tu cuenta de GitHub
2. Selecciona tu repositorio
3. Render detectará automáticamente el `Dockerfile`

### 4. Configura el servicio

- **Name**: pdf-invoice-extractor (o el que quieras)
- **Environment**: Docker
- **Plan**: Free

### 5. Agrega la variable de entorno

En la sección **Environment**:
- Click en **Add Environment Variable**
- Key: `OPENAI_API_KEY`
- Value: tu API key de OpenAI

### 6. Deploy

Click en **Create Web Service**

Render automáticamente:
- Construirá la imagen Docker
- Instalará poppler-utils (pdftoppm)
- Desplegará tu app

### 7. Listo!

Tu app estará disponible en: `https://tu-app.onrender.com`

## Notas:

- El plan gratuito de Render puede tardar ~1 minuto en arrancar si no se usa
- Tiene límite de 750 horas/mes (suficiente para uso personal)
- Soporta comandos del sistema como pdftoppm
- Redeploy automático cuando haces push a GitHub

## Alternativa rápida sin GitHub:

Si no quieres usar GitHub, puedes usar Render CLI:

```bash
# Instalar Render CLI
npm install -g @render/cli

# Login
render login

# Deploy
render deploy
```
