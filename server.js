const fs = require('fs'); 
const path = require('path');
const Handlebars = require('handlebars');
const { chromium } = require('playwright');
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

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
   Compatible con:
   - Apphive (m / n / s / u)
   - Apphive wrapper return.args
   - Postman directo
================================= */

function extractData(body) {
  if (!body) return null;

  console.log("BODY CRUDO RECIBIDO:", JSON.stringify(body, null, 2));

  // Caso Apphive: body.s viene como string JSON
  if (body.s) {
    try {
      const parsed = JSON.parse(body.s);
      return parsed;
    } catch (error) {
      console.error("Error parseando body.s:", error);
      return null;
    }
  }

  // Caso wrapper return.args
  if (body.return && body.return.args) {
    return body.return.args;
  }

  // Caso Postman directo
  return body;
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
    const data = extractData(req.body);

    if (!data) {
      return res.status(400).json({
        error: 'No se pudo interpretar el body recibido'
      });
    }

    console.log('DATA PROCESADA:', JSON.stringify(data, null, 2));

    const templatePath = path.join(__dirname, 'views', 'ticket.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf8');

    const template = Handlebars.compile(templateSource);
    const html = template(data);

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });

    const pdfBuffer = await page.pdf({
      width: '80mm',
      printBackground: true,
      margin: {
        top: '5mm',
        bottom: '5mm',
        left: '5mm',
        right: '5mm'
      }
    });

    /* ==============================
       SUBIR A R2
    ================================= */

    const fileName = `ticket-${Date.now()}.pdf`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    res.json({
      success: true,
      url: publicUrl
    });

  } catch (error) {
    console.error('Error generando PDF:', error);
    res.status(500).json({
      error: 'Error generando PDF'
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
