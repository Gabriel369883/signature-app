const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
const { PDFDocument } = require("pdf-lib");

const app = express();
const PORT = process.env.PORT || 3000;

// Fonction d'envoi de l'email
async function sendEmailWithPdf(toEmail) {
  const link = `${process.env.FRONT_URL}/index.html`; // URL du frontend hébergé

  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const pdfPath = path.join(__dirname, "input.pdf");

  let info = await transporter.sendMail({
    from: `"Signature App" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: "Merci de signer ce document",
    text: `Bonjour,

Veuillez cliquer sur ce lien pour signer le document :
${link}

Cordialement.`,
    attachments: [
      {
        filename: "document-à-signer.pdf",
        path: pdfPath,
      },
    ],
  });

  console.log("✅ Email envoyé :", info.messageId);
}

// Middlewares
app.use(express.json({ limit: "10mb" }));
app.use(cors());
app.use(express.static("public"));

// Route pour envoyer un mail
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

// Route pour signer le PDF
app.post("/sign", async (req, res) => {
  try {
    const signature = req.body.signature;

    if (!signature) {
      return res.status(400).json({ error: "Signature manquante." });
    }

    const base64Data = signature.replace(/^data:image\/png;base64,/, "");

    const signaturePath = path.join(__dirname, "signature.png");
    fs.writeFileSync(signaturePath, base64Data, "base64");

    const pdfPath = path.join(__dirname, "input.pdf");
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const imageBytes = fs.readFileSync(signaturePath);
    const pngImage = await pdfDoc.embedPng(imageBytes);

    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const sigX = 100;
    const sigY = 150;
    const sigWidth = 150;
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth;

    firstPage.drawImage(pngImage, {
      x: sigX,
      y: sigY,
      width: sigWidth,
      height: sigHeight,
    });

    // Sauver le PDF en mémoire
const outputPdf = await pdfDoc.save();

// Envoyer le PDF signé par mail en pièce jointe
let transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

   await transporter.sendMail({
   from: '"Signature App" <gabrieldayan01@gmail.com>',
   to: "DESTINATAIRE@EXEMPLE.COM", // <-- adapte ça dynamiquement si besoin
   subject: "Document signé",
   text: "Veuillez trouver ci-joint le PDF signé.",
   attachments: [
    {
      filename: "document-signé.pdf",
      content: Buffer.from(outputPdf),
      contentType: "application/pdf",
    },
   ],
   });

   console.log("✅ PDF signé envoyé par mail");


  } catch (err) {
    console.error("❌ Erreur PDF :", err);
    res.status(500).json({ error: "Erreur lors de la génération du PDF." });
  }
});

// Route pour télécharger le PDF signé
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

app.listen(PORT, () => {
  console.log("✅ Serveur backend démarré.");
});

