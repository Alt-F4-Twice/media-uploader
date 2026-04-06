import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // 🔒 API protection
    if (req.headers["x-api-key"] !== process.env.API_KEY) {
      return res.status(403).send("Forbidden");
    }

    const form = new FormData();

    // Add image with filename + content type
    form.append("file", fs.createReadStream(req.file.path), {
      filename: "screenshot.png",
      contentType: "image/png"
    });

    // Optional: add a message so it shows nicely in Discord
    form.append("content", "📸 New Screenshot");

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      body: form,
      headers: form.getHeaders() // ← important!
    });

    // Delete file after sending (optional for privacy)
    fs.unlinkSync(req.file.path);

    res.send("Sent to Discord!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => console.log("Server running"));
