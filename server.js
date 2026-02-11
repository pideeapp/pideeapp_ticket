const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const { chromium } = require('playwright');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para recibir JSON
app.use(express.json({ limit: '10mb' }));

/* ==============================
   RUTAS
================================= */

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('Servidor PIDEE funcionando correctamente 🚀');
});

// Endpoint para generar PDF real
app.post('/generar-pdf', async (req, res) => {
  let browser;

  try {
    // 🔹 Extraer datos desde Apphive o pruebas manuales
const data = req.body.s || (req.body.return && req.body.return.args);

if (!data) {
  return res.status(400).json({
    error: 'Formato inválido. Se esperaba body.s (Apphive) o return.args'
  });
}
    // 🔹 Leer plantilla
    const templatePath = path.join(__dirname, 'views', 'ticket.hbs');
    const templateSource = fs.readFileSync(templatePath, 'utf8');

    // 🔹 Compilar plantilla
    const template = Handlebars.compile(templateSource);
    const html = template(data);

    // 🔹 Lanzar navegador (IMPORTANTE para Docker/Railway)
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: 'networkidle' });

    // 🔹 Generar PDF estilo ticket 80mm
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

    // 🔹 Enviar PDF
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
    if (browser) {
      await browser.close();
    }
  }
});

/* ==============================
   INICIAR SERVIDOR
================================= */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
