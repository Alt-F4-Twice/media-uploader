import express from "express";

// In-memory logs
const logs = [];

// Admin password (change this)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "supersecret123";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Helper: UK timestamp
function getUKTimestamp() {
  const now = new Date();
  return now.toLocaleString("en-GB", { timeZone: "Europe/London" });
}

// ----------------- New logs endpoint -----------------
app.post("/log", (req, res) => {
  // Only accept logs from your /upload backend
  const { user, message, hasImage } = req.body;
  const timestamp = getUKTimestamp();

  logs.push({ user, message, hasImage, timestamp });
  res.send("Logged!");
});

// ----------------- Admin logs view -----------------
app.get("/logs", (req, res) => {
  const password = req.query.password;
  if (password !== ADMIN_PASSWORD) return res.status(403).send("Forbidden");

  let html = "<h1>Upload Logs</h1><ul>";
  logs.forEach((log) => {
    html += `<li><strong>${log.timestamp}</strong> - ${log.user} - ${log.hasImage ? "Photo" : ""}${log.hasImage && log.message ? " + " : ""}${log.message ? "Message" : ""}${!log.hasImage && !log.message ? "Nothing" : ""}</li>`;
  });
  html += "</ul>";
  res.send(html);
});

app.listen(3000, () => console.log("Server running on port 3000"));
