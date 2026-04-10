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

    // 🔥 Send to Discord
    const response = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
    });

    const discordResponse = await response.text();

    console.log("DISCORD STATUS:", response.status);
    console.log("DISCORD RESPONSE:", discordResponse);

    // ❌ If Discord failed
    if (response.status !== 204) {
      return res
        .status(500)
        .send(`Discord failed (${response.status}): ${discordResponse}`);
    }

    // ✅ Save log
    logs.push({
      user,
      timestamp,
      message: messageText,
      hasImage,
    });

    // ✅ Build response message
    let responseMessage = "Upload sent to Discord!";

    if (hasImage) {
      const sizeMB = req.file.size / (1024 * 1024);

      if (sizeMB > 7.5) {
        responseMessage += " (⚠️ Very large — may fail upload)";
      } else if (sizeMB > 4) {
        responseMessage += " (⚠️ Large — may not preview as image)";
      }

      // 🧹 Delete file AFTER sending
      fs.unlink(req.file.path, () => {});
    }

    res.send(responseMessage);

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).send("Error");
  }
});
