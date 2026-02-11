const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { chromium } = require('playwright');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

/* ==============================
   FUNCION UNIVERSAL DE EXTRACCIÓN
================================= */
function extractData(body) {
  if (!body) return null;

  // AppHive formato actual
  if (body.s) return body.s;

  // Formato antiguo pruebas
  if (body.return && body.return.args) return body.return.args;

  // Postman / Web / pruebas directas
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

    console.log('DATA RECIBIDA:', JSON.stringify(data, null, 2));

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

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length
    });

    res.send(pdfBuffer);

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
