const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { chromium } = require('playwright');
const express = require('express');
const cors = require('cors'); // ✅ NUEVO
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;

/* ==============================
   CORS
================================= */
app.use(cors({
  origin: '*',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.options('*', cors());

/* ==============================
   LECTURA UNIVERSAL DEL BODY
================================= */
app.use(express.text({ type: '*/*', limit: '10mb' }));

/* ==============================
   CONFIGURACIÓN R2
================================= */
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/* ==============================
   FUNCIÓN UNIVERSAL DE EXTRACCIÓN
================================= */
function extractData(body) {
  if (!body) return null;

  console.log("BODY RECIBIDO CRUDO:", JSON.stringify(body, null, 2));

  // Apphive: s como objeto
  if (body.s && typeof body.s === 'object') return body.s;

  // Apphive: s como string
  if (body.s && typeof body.s === 'string') {
    try {
      return JSON.parse(body.s);
    } catch (err) {
      console.error("Error parseando body.s:", err);
      return null;
    }
  }

  // Wrapper return.args
  if (body.return && body.return.args) return body.return.args;

  // JSON directo
  if (typeof body === 'object') return body;

  return null;
}

/* ==============================
   RUTAS
================================= */
app.get('/', (req, res) => {
  res.send('Servidor PIDEE funcionando correctamente 🚀');
});

app.post('/generar-pdf', async (req, res) => {
  let browser;

  try {
    // Parse inicial del body
    let parsedBody;
    try {
      parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (err) {
      console.error("Error parseando body principal:", err);
      return res.status(400).json({ error: "Body inválido" });
    }

    const data = extractData(parsedBody);
    if (!data) return res.status(400).json({ error: "No se pudo interpretar el body recibido" });

    console.log('DATA PROCESADA:', JSON.stringify(data, null, 2));

    // Generar HTML con Handlebars
    const templatePath = path.join(__dirname, 'views', 'ticket.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    const html = template(data);

    // Generar PDF con Playwright
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: { top: '5mm', bottom: '5mm', left: '5mm', right: '5mm' }
    });

    // Subir PDF a R2
    const fileName = `ticket-${Date.now()}.pdf`;
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    return res.json({ success: true, url: publicUrl });

  } catch (error) {
    console.error('Error generando PDF:', error);
    return res.status(500).json({ error: 'Error generando PDF' });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
