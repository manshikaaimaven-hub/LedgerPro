const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const outDir = path.resolve(__dirname, "out");

// Static route resolver for Next.js static export (SSG/output: "export")
app.use((req, res) => {
  let cleanPath = req.path;
  if (cleanPath.endsWith("/") && cleanPath.length > 1) {
    cleanPath = cleanPath.slice(0, -1);
  }

  // 1. Root route "/"
  if (cleanPath === "" || cleanPath === "/") {
    const rootIndexPath = path.join(outDir, "index.html");
    if (fs.existsSync(rootIndexPath)) {
      return res.sendFile(rootIndexPath);
    }
  }

  // 2. Direct static file (e.g., _next/static/..., favicon.ico, images, txt files)
  const directPath = path.join(outDir, cleanPath);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    return res.sendFile(directPath);
  }

  // 3. Page route mapped to [cleanPath].html (e.g. /customer/customer-signup -> out/customer/customer-signup.html)
  const htmlFilePath = path.join(outDir, `${cleanPath}.html`);
  if (fs.existsSync(htmlFilePath) && fs.statSync(htmlFilePath).isFile()) {
    return res.sendFile(htmlFilePath);
  }

  // 4. Page route mapped to [cleanPath]/index.html
  const nestedIndexPath = path.join(outDir, cleanPath, "index.html");
  if (fs.existsSync(nestedIndexPath) && fs.statSync(nestedIndexPath).isFile()) {
    return res.sendFile(nestedIndexPath);
  }

  // 5. 404 fallback
  const notFoundPath = path.join(outDir, "404.html");
  if (fs.existsSync(notFoundPath)) {
    return res.status(404).sendFile(notFoundPath);
  }
  const altNotFoundPath = path.join(outDir, "_not-found.html");
  if (fs.existsSync(altNotFoundPath)) {
    return res.status(404).sendFile(altNotFoundPath);
  }

  return res.status(404).send("Page not found");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend running on port ${PORT}`);
});