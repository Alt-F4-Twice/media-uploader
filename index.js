import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const app = express();
const upload = multer({ dest: "uploads/" });

// Environment variables
const ADMIN_PASSWORD = process.env.LOGS_PASSWORD;
const API_KEY = process.env.API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;

if (!ADMIN_PASSWORD) console.warn("⚠️ LOGS_PASSWORD not set!");
if (!API_KEY) console.warn("⚠️ API_KEY not set!");
if (!DISCORD_WEBHOOK) console.warn("⚠️ DISCORD_WEBHOOK not set!");

// In‑memory logs
const logs = [];

// UK timestamp helper
function getUKTimestamp() {
  return new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
}

// ----------------- UPLOAD ENDPOINT -----------------
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(403).send("Forbidden");
    }

    const user = req.body.user || "Unknown";
    const messageText = req.body.message || "";
    const timestamp = getUKTimestamp();
    const hasImage = Boolean(req.file);

    const content = `By: ${user}\nDate & Time (UK): ${timestamp}\n${messageText}`;

    const form = new FormData();
    form.append("content", content);

    if (hasImage) {
      form.append("file", fs.createReadStream(req.file.path), {
        filename: req.file.originalname || "upload.png",
        contentType: req.file.mimetype || "image/png",
      });
    }

    // Send to Discord
   const response = await fetch(DISCORD_WEBHOOK, {
  method: "POST",
  body: form,
  headers: form.getHeaders(),
});

const text = await response.text();

console.log("DISCORD STATUS:", response.status);
console.log("DISCORD RESPONSE:", text);

    // Save log
    logs.push({
      user,
      timestamp,
      message: messageText,
      hasImage,
    });

    // Build response message
    let responseMessage = "Upload sent to Discord!";

    if (hasImage) {
      const sizeMB = req.file.size / (1024 * 1024);

      if (sizeMB > 7.5) {
        responseMessage += " (⚠️ Very large — may fail upload)";
      } else if (sizeMB > 4) {
        responseMessage += " (⚠️ Large — may not preview as image)";
      }

      // Cleanup
      fs.unlink(req.file.path, () => {});
    }

    res.send(responseMessage);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Error");
  }
});

// ----------------- ADMIN LOGS -----------------
app.get("/logs", (req, res) => {
  if (req.query.password !== ADMIN_PASSWORD) {
    return res.status(403).send("Forbidden");
  }

  const html = `
    <h1>Upload Logs</h1>
    <ul>
      ${logs
        .map(
          (log) => `
        <li>
          <strong>${log.timestamp}</strong> - ${log.user} -
          ${log.hasImage ? "Photo" : ""}
          ${log.hasImage && log.message ? " + " : ""}
          ${log.message ? "Message" : ""}
          ${!log.hasImage && !log.message ? "Nothing" : ""}
        </li>`
        )
        .join("")}
    </ul>
  `;

  res.send(html);
});

// ----------------- START SERVER -----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
