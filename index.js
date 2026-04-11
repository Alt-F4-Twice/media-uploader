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

// =========================
// ✅ QUEUE SYSTEM (FIX)
// =========================
const queue = [];
let processing = false;

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const { form, resolve, reject } = queue.shift();

    try {
      const response = await fetch(DISCORD_WEBHOOK, {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      });

      const text = await response.text();

      // Handle Discord rate limit (429)
      if (response.status === 429) {
        let retryAfter = 2000;

        try {
          const data = JSON.parse(text);
          retryAfter = (data.retry_after || 2) * 1000;
        } catch {}

        console.log("⏳ Rate limited. Waiting:", retryAfter);

        await new Promise(r => setTimeout(r, retryAfter));

        queue.unshift({ form, resolve, reject });
        continue;
      }

      resolve({ response, text });

      // small safety delay
      await new Promise(r => setTimeout(r, 400));

    } catch (err) {
      reject(err);
    }
  }

  processing = false;
}

function enqueue(form) {
  return new Promise((resolve, reject) => {
    queue.push({ form, resolve, reject });
    processQueue();
  });
}

// UK timestamp helper
function getUKTimestamp() {
  return new Date().toLocaleString("en-GB", { timeZone: "Europe/London" });
}

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(403).send("Forbidden");
    }

    const user = req.body.user || "Unknown";
    const messageText = req.body.message || "";
    const timestamp = getUKTimestamp();
    const hasImage = Boolean(req.file);

    // Build final message
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

    // =========================
    // FIXED DISCORD SEND
    // =========================
    const { response, text: discordResponse } = await enqueue(form);

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

// ----------------- START SERVER -----------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
