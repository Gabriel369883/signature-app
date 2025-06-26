const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { PDFDocument, rgb } = require("pdf-lib");

const app = express();
const PORT = 3000;

// Ta fonction sendEmailWithPdf ici, avant les routes
async function sendEmailWithPdf(toEmail) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "gabrieldayan01@gmail.com",
      pass: "hayr qnop nojs ifuu",
    },
  });

  const pdfPath = path.join(__dirname, "input.pdf");

  let info = await transporter.sendMail({
    from: '"Signature App" <gabrieldayan01@gmail.com>',
    to: toEmail,
    subject: "Merci de signer ce document",
    text: "Bonjour,\n\n Si ce devis vous convient merci de bien vouloir le signer via ce lien : http://ton-ip:3000\n\nCordialement",
    attachments: [
      {
        filename: "document-à-signer.pdf",
        path: pdfPath,
      },
    ],
  });

  console.log("✅ Email envoyé :", info.messageId);
}

// Middleware pour parser le JSON (notamment les images en base64)
app.use(express.json({ limit: "10mb" }));
app.use(cors());

// Route POST pour envoyer le mail
app.post("/send-mail", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email requis" });

  try {
    await sendEmailWithPdf(email);
    res.json({ message: "Email envoyé avec succès" });
  } catch (err) {
    console.error("❌ Erreur envoi mail :", err);
    res.status(500).json({ error: "Erreur lors de l’envoi du mail" });
  }
});

// Servir les fichiers statiques (ex: index.html dans public/)
app.use(express.static("public"));

// Route POST pour recevoir la signature et générer le PDF signé
app.post("/sign", async (req, res) => {
  try {
    const signature = req.body.signature;

    if (!signature) {
      return res.status(400).json({ error: "Signature manquante." });
    }

    // Extraire les données base64 de la signature
    const base64Data = signature.replace(/^data:image\/png;base64,/, "");

    // Sauvegarder l'image temporairement
    const signaturePath = path.join(__dirname, "signature.png");
    fs.writeFileSync(signaturePath, base64Data, "base64");

    // Charger le PDF modèle
    const pdfPath = path.join(__dirname, "input.pdf");
    const pdfBytes = fs.readFileSync(pdfPath);

    // Charger le PDF avec pdf-lib
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Intégrer l’image de signature dans le PDF
    const imageBytes = fs.readFileSync(signaturePath);
    const pngImage = await pdfDoc.embedPng(imageBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Position et taille de la signature (ajuste selon ton PDF)
    const sigX = 100;
    const sigY = 150;
    const sigWidth = 150;
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth;

    // Coller la signature sur la page
    firstPage.drawImage(pngImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    // Sauver le nouveau PDF
    const outputPdf = await pdfDoc.save();
    const outputPath = path.join(__dirname, "output.pdf");
    fs.writeFileSync(outputPath, outputPdf);

    console.log("✅ PDF signé généré :", outputPath);

    res.json({ message: "PDF signé créé avec succès." });
  } catch (err) {
    console.error("❌ Erreur PDF :", err);
    res.status(500).json({ error: "Erreur lors de la génération du PDF." });
  }
});

// Route GET pour télécharger le PDF signé
app.get("/download", (req, res) => {
  const filePath = path.join(__dirname, "output.pdf");
  res.download(filePath, "document-signé.pdf", (err) => {
    if (err) {
      console.error("❌ Erreur de téléchargement :", err);
      res.status(500).send("Erreur lors du téléchargement.");
    } else {
      console.log("✅ PDF téléchargé.");
    }
  });
});

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur backend sur http://localhost:${PORT}`);
});
