
const multer = require("multer");
const nodemailer = require("nodemailer");

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

const upload = multer({ dest: "uploads/" });

app.use(express.json());

// combine opro into window subdomain
app.use((req, res, next) => {
  const host = req.headers.host || "";

  if (host.startsWith("opro.")) {
  //if (host.startsWith("opro.") || req.query.site === "opro") {
    return express.static(path.join(__dirname, "public-opro"))(req, res, next);
  }

  return express.static(path.join(__dirname, "public"))(req, res, next);
});

app.use((req, res, next) => {
  const host = req.headers.host || "";

  if (host.startsWith("opro.")) {
  //if (host.startsWith("opro.") || req.query.site === "opro") {

    return res.sendFile(path.join(__dirname, "public-opro", "index.html"));
  }

  next();
});





function readJson(fileName) {
  const filePath = path.join(__dirname, "private-data", fileName);
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

app.post("/api/login", (req, res) => {
  const { supplierId, verifyCode } = req.body;
  const db = readJson("iddatabase.json");

  if (db.suppliers[supplierId] === verifyCode) {
    return res.json({ success: true });
  }

  res.status(401).json({
    success: false,
    message: "Invalid Supplier ID or verification code"
  });
});

app.post("/api/quote", (req, res) => {
  const { rows, promotionCode } = req.body;

  const params = readJson("calculations.json");
  const db = readJson("iddatabase.json");

  let quote = 0;
  let rowCosts = [];

  rows.forEach(row => {
    const A = Number(row.numWindows) || 0;
    const B = Number(row.height) || 0;
    const C = Number(row.heightFraction) || 0;
    const D = Number(row.width) || 0;
    const E = Number(row.widthFraction) || 0;
    const F = Number(row.openings) || 0;
    const G = Number(row.glassPattern) || 0;
    const H = Number(row.addings) || 0;

    const area = Math.max(((B + C) * (D + E)) / 144, params.p4) * A;

    // frame = area * price
    // opens = opens per window * number of window * open price 
    // special glass = area * w/o pattern(1/0) * glassPattern price 
    // addings = addings(1/0) * number of window
    const cost =
      area * params.p1 +
      F * A * params.p2 +
      G * area * params.p3 +
      H * A * params.p6 ;

    quote += cost;
    rowCosts.push(cost.toFixed(2));


  });

  const tax = quote * params.p5;

  // Following your formula: Total = quote - tax
  const total = quote + tax;

  let discountTotal = "";

  if (promotionCode && db.promotions[promotionCode]) {
    discountTotal = - quote * (1-db.promotions[promotionCode]);
  }

  res.json({
    quote: quote.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    discountTotal: discountTotal === "" ? "" : discountTotal.toFixed(2),
    rowCosts: rowCosts
  });


});




app.post("/api/submit-project", upload.array("designFiles"), async (req, res) => {
  try {
    const rows = JSON.parse(req.body.rows || "[]");

    const emailBody = `
New window order submission

Quote: $${req.body.quote}
Tax: $${req.body.tax}
Total: $${req.body.total}
Discount Quote: $${req.body.discountQuote}
Promotion Code: ${req.body.promotionCode || "None"}

Order Details:
${JSON.stringify(rows, null, 2)}
    `;

    const attachments = req.files.map(file => ({
      filename: file.originalname,
      path: file.path
    }));

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: "admin-window@derivativeinsight.com",
  subject: "New Window Project Submission",
  text: emailBody,
  attachments: attachments
});

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.post("/api/submit-cart", upload.array("designFiles"), async (req, res) => {
  try {
    const cart = JSON.parse(req.body.cart || "[]");

    let emailBody = "New window cart submission\n\n";

    cart.forEach((project, index) => {
      emailBody += `PROJECT ${index + 1}\n`;
      emailBody += `Quote: $${project.quote}\n`;
      emailBody += `Tax: $${project.tax}\n`;
      emailBody += `Total: $${project.total}\n`;
      emailBody += `Discount Quote: $${project.discountQuote}\n`;
      emailBody += `Promotion Code: ${project.promotionCode || "None"}\n\n`;

      emailBody += "Rows:\n";
      emailBody += JSON.stringify(project.rows, null, 2);
      emailBody += "\n\n----------------------\n\n";
    });

    const attachments = req.files.map(file => ({
      filename: file.originalname,
      path: file.path
    }));

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 587,
      secure: false,
      auth: {
        user: "admin-window@derivativeinsight.com",
        pass: "Dhy2339003"
      }
    });

    await transporter.sendMail({
      from: "admin-window@derivativeinsight.com",
      to: "admin-window@derivativeinsight.com",
      subject: "New Window Cart Submission",
      text: emailBody,
      attachments: attachments
    });

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});