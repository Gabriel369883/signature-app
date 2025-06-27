require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { PDFDocument } = require("pdf-lib");
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.static("public"));

// Multer config (upload de PDF)
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, "current.pdf"),
});
const upload = multer({ storage });

// Redirection racine
app.get("/", (req, res) => {
  res.redirect("/admin.html");
});

// Envoi d'un PDF et email
app.post("/send-pdf", upload.single("pdf"), async (req, res) => {
  const { email } = req.body;

  if (!req.file || !email) {
    return res.status(400).json({ error: "PDF ou email manquant" });
  }

  const link = `${process.env.FRONT_URL || "http://localhost:3000"}/signer.html`;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"Signature App" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: "Merci de signer ce document",
      text: `Bonjour, merci de signer le document via ce lien : ${link}`,
      attachments: [{ filename: "document.pdf", path: req.file.path }],
    });

    res.json({ message: "Email envoyé avec succès." });
  } catch (err) {
    console.error("Erreur envoi mail :", err);
    res.status(500).json({ error: "Erreur lors de l’envoi du mail." });
  }
});

// Enregistrement de la signature
app.post("/sign", async (req, res) => {
  const { signature } = req.body;
  if (!signature) return res.status(400).json({ error: "Signature manquante" });

  try {
    const base64 = signature.replace(/^data:image\/png;base64,/, "");
    fs.writeFileSync("signature.png", base64, "base64");
    console.log("✅ Signature PNG enregistrée");

    const pdfBytes = fs.readFileSync("uploads/current.pdf");
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pngImage = await pdfDoc.embedPng(fs.readFileSync("signature.png"));

    const page = pdfDoc.getPages()[0];
    page.drawImage(pngImage, {
      x: 100,
      y: 150,
      width: 150,
      height: (pngImage.height / pngImage.width) * 150,
    });

    const outputPdf = await pdfDoc.save();
    fs.writeFileSync("uploads/signed.pdf", outputPdf);
    console.log("✅ PDF signé enregistré");

    res.json({ message: "Document signé avec succès." });
  } catch (error) {
    console.error("❌ Erreur dans /sign :", error);
    res.status(500).json({ error: "Erreur lors de la signature du PDF" });
  }
});

// Téléchargement du PDF signé
app.get("/download", (req, res) => {
  const file = "uploads/signed.pdf";
  if (!fs.existsSync(file)) return res.status(404).send("Fichier non trouvé.");
  res.download(file, "document-signé.pdf");
});

app.listen(PORT, () => {
  console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});
