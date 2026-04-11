// Import labels
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

// In-memory logs
const logs = [];

// GLOBAL rate limiter (IMPORTANT)
let lastSent = 0;

// UK timestamp helper
function getUKTimestamp() {
  return new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
}

// Discord sender (queue + rate limit)
async function sendToDiscord(form) {
  const now = Date.now();

  const delay = Math.max(0, 500 - (now - lastSent));
  if (delay > 0) {
    await new Promise(r => setTimeout(r, delay));
  }

  lastSent = Date.now();

  const response = await fetch(DISCORD_WEBHOOK, {
    method: "POST",
    body: form,
    headers: form.getHeaders()
  });

  const text = await response.text();

  return { response, text };
}

// Upload route
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(403).send("Forbidden");
    }

    const user = req.body.user || "Unknown";
    const messageText = req.body.message || "";
    const timestamp = getUKTimestamp();
    const hasImage = Boolean(req.file);

    // Build message
    let message = `By: ${user}\nDate & Time (UK): ${timestamp}`;

    if (messageText) {
      message += `\n${messageText}`;
    }

    // Create form
    const form = new FormData();
    form.append("content", message);

    if (hasImage) {
      form.append("file", fs.createReadStream(req.file.path));
    }

    // Send to Discord
    const { response, text: discordResponse } = await sendToDiscord(form);

    console.log("DISCORD STATUS:", response.status);
    console.log("DISCORD RESPONSE:", discordResponse);

    if (response.status !== 204) {
      return res.status(500).send(
        `Discord failed (${response.status}): ${discordResponse}`
      );
    }

    // Save log
    logs.push({
      user,
      timestamp,
      message: messageText,
      hasImage,
    });

    // Cleanup file
    if (hasImage) {
      fs.unlink(req.file.path, () => {});
    }

    res.send("Upload sent to Discord!");

  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
