const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const outDir = path.join(__dirname, "out");

app.use(express.static(outDir, { extensions: ["html"] }));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(outDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend running on port ${PORT}`);
});