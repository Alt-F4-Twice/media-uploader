import express from "express";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/upload", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== process.env.API_KEY) {
      return res.status(403).send("Forbidden");
    }

    // Get user and message from Shortcut
    const user = req.body.user || "Unknown";
    const messageText = req.body.message || "No message provided";

    // Current date & time
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    // Build Discord message
    const fullMessage = `📩 New Message\nBy: ${user}\nDate & Time: ${timestamp}\nMessage: ${messageText}`;

    const form = new FormData();
    form.append("content", fullMessage);

    await fetch(process.env.DISCORD_WEBHOOK, {
      method: "POST",
      body: form,
      headers: form.getHeaders()
    });

    res.send("Message sent to Discord!");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => console.log("Server running"));
