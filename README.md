# Extractor de Facturas PDF con GPT-4o-mini

Aplicación Next.js serverless que extrae datos de facturas PDF usando GPT-4o-mini.

## Configuración

1. Instalar dependencias:
```bash
npm install
```

2. Configurar API key de OpenAI:
```bash
# Editar .env.local
OPENAI_API_KEY=tu_api_key_aqui
```

3. Ejecutar en desarrollo:
```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Desplegar en Vercel

1. Sube el proyecto a GitHub
2. Importa el repositorio en [Vercel](https://vercel.com)
3. Agrega la variable de entorno `OPENAI_API_KEY` en la configuración del proyecto
4. Despliega

## Uso

1. Sube un PDF de factura
2. Haz clic en "Extraer Datos"
3. GPT-4o-mini analizará el PDF y extraerá:
   - Lista de productos con descripción, cantidad, precio y total
   - Total general de la factura

## Estructura

- `/app/page.js` - Frontend con formulario de carga
- `/app/api/extract/route.js` - API serverless que procesa PDFs con GPT-4o-mini
- `/PDF/` - Carpeta con PDFs de ejemplo

## Tecnologías

- Next.js 14 (App Router)
- OpenAI GPT-4o-mini
- pdf-parse
- Vercel (serverless deployment)
