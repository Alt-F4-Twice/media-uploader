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

    // Get current date and time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Build message
    const message = `📸 New Screenshot\nDate & Time: ${timestamp}`;

    const form = new FormData();

    // Add image with filename + content type
    form.append("file", fs.createReadStream(req.file.path), {
      filename: "screenshot.png",
      contentType: "image/png"
    });

    // Add message content with timestamp
    form.append("content", message);

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    // Delete uploaded file after sending
    fs.unlinkSync(req.file.path);

    res.send("Sent to Discord!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => console.log("Server running"));
