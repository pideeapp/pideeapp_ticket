const express = require("express");
const cors = require("cors");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;

/* ======================
   MIDDLEWARE
====================== */

app.use(cors()); // Maneja CORS automáticamente
app.use(express.json());

/* ======================
   RUTA DE PRUEBA
====================== */

app.get("/", (req, res) => {
  res.send("Servidor PIDEE Ticket activo 🚀");
});

/* ======================
   GENERAR PDF
====================== */

app.post("/generar-pdf", async (req, res) => {
  try {
    const pedido = req.body;

    const doc = new PDFDocument({
      size: [226, 600],
      margin: 10
    });

    let buffers = [];

    doc.on("data", buffers.push.bind(buffers));

    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": pdfData.length
      });

      res.end(pdfData);
    });

    /* ======================
       CONTENIDO DEL TICKET
    ======================= */

    doc.fontSize(12).text("PIDEE.APP", { align: "center" });
    doc.moveDown();

    doc.fontSize(9).text(`Pedido: ${pedido.id || ""}`);
    doc.text(`Cliente: ${pedido.cliente || ""}`);
    doc.text(`Fecha: ${pedido.fecha || ""}`);
    doc.moveDown();

    if (pedido.productos && Array.isArray(pedido.productos)) {
      pedido.productos.forEach((item) => {
        doc.text(`${item.cantidad} x ${item.nombre}`);
      });
    }

    doc.moveDown();
    doc.text(`Total: $${pedido.total || 0}`);

    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Error generando PDF"
    });
  }
});

/* ======================
   START SERVER
====================== */

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
