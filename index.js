import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

// Use environment variable for admin password
const ADMIN_PASSWORD = process.env.LOGS_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.warn("⚠️ LOGS_PASSWORD not set in environment variables!");
}

// In-memory logs
const logs = [];

// Helper: UK timestamp
function getUKTimestamp() {
  const now = new Date();
  return now.toLocaleString("en-GB", { timeZone: "Europe/London" });
}

// ----------------- /upload stays the same -----------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== process.env.API_KEY) {
      return res.status(403).send("Forbidden");
    }

    const user = req.body.user || "Unknown";
    const messageText = req.body.message || "";
    const hasImage = !!req.file;
    const timestamp = getUKTimestamp();

    const content = `By: ${user}\nDate & Time (UK): ${timestamp}\n${messageText}`;

    const form = new FormData();
    form.append("content", content);

    if (hasImage) {
      form.append("file", fs.createReadStream(req.file.path), {
        filename: req.file.originalname || "upload.png",
        contentType: "image/png",
      });
    }

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    logs.push({
      user,
      timestamp,
      message: messageText,
      hasImage,
    });

    if (hasImage) fs.unlinkSync(req.file.path);

    res.send("Upload sent to Discord!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// ----------------- Admin logs -----------------
app.get("/logs", (req, res) => {
  const password = req.query.password;
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(403).send("Forbidden");
  }

  let html = "<h1>Upload Logs</h1><ul>";
  logs.forEach((log) => {
    html += `<li><strong>${log.timestamp}</strong> - ${log.user} - ${
      log.hasImage ? "Photo" : ""
    }${log.hasImage && log.message ? " + " : ""}${
      log.message ? "Message" : ""
    }${!log.hasImage && !log.message ? "Nothing" : ""}</li>`;
  });
  html += "</ul>";
  res.send(html);
});

app.listen(3000, () => console.log("Server running"));
