import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== process.env.API_KEY) {
      return res.status(403).send("Forbidden");
    }

    const user = req.body.user || "Unknown";
    const messageText = req.body.message || "";

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Build message
    const fullMessage = `By: ${user}\nDate & Time: ${timestamp}\n${messageText}`;

    const form = new FormData();
    form.append("content", fullMessage);

    // Attach image if present
    if (req.file) {
      form.append("file", fs.createReadStream(req.file.path), {
        filename: "upload.png",
        contentType: "image/png",
      });
    }

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    if (req.file) fs.unlinkSync(req.file.path);

    res.send("Message sent to Discord!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => console.log("Server running"));
