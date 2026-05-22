
const multer = require("multer");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { createClient } = require("@supabase/supabase-js");

const express = require("express");
const fs = require("fs");
const path = require("path");

const BCRYPT_ROUNDS = 10;
const USERS_TABLE = "users";

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

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

function writeJson(fileName, data) {
  const filePath = path.join(__dirname, "private-data", fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readUserDataStore() {
  const filePath = path.join(__dirname, "private-data", "user-data.json");

  if (!fs.existsSync(filePath)) {
    return { userData: {} };
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeUserDataStore(data) {
  writeJson("user-data.json", data);
}

function getStoredUserData(username) {
  const store = readUserDataStore();
  return store.userData[username] || { cart: [], orderDraft: null };
}

function saveStoredUserData(username, cart, orderDraft) {
  const store = readUserDataStore();
  store.userData[username] = {
    cart: Array.isArray(cart) ? cart : [],
    orderDraft: orderDraft || null
  };
  writeUserDataStore(store);
}

function mapSupabaseUser(row) {
  return {
    fullName: row.full_name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    message: row.message || ""
  };
}

function isDuplicateUsernameError(error) {
  return error?.code === "23505";
}

async function findRegisteredUser(username) {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const { data, error } = await supabase
    .from(USERS_TABLE)
    .select(
      "username, password_hash, full_name, company_name, email, phone, message, created_at"
    )
    .eq("username", username)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

app.post("/api/login", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const password = req.body.password;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "User name and password are required."
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: "User login is temporarily unavailable. Please try again later."
      });
    }

    const registeredUser = await findRegisteredUser(username);

    if (registeredUser?.password_hash) {
      const passwordMatches = await bcrypt.compare(
        password,
        registeredUser.password_hash
      );

      if (passwordMatches) {
        return res.json({
          success: true,
          registered: true,
          username: registeredUser.username
        });
      }
    }

    const idDb = readJson("iddatabase.json");

    if (idDb.suppliers[username] === password) {
      return res.json({
        success: true,
        guest: true,
        username
      });
    }

    return res.status(401).json({
      success: false,
      message: "User name or password is incorrect."
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to sign in right now. Please try again later."
    });
  }
});

app.post("/api/register", async (req, res) => {
  try {
    const {
      username,
      password,
      confirmPassword,
      fullName,
      companyName,
      email,
      phone,
      message
    } = req.body;

    const trimmedUsername = String(username || "").trim();
    const trimmedFullName = String(fullName || "").trim();
    const trimmedCompanyName = String(companyName || "").trim();
    const trimmedEmail = String(email || "").trim();
    const trimmedPhone = String(phone || "").trim();
    const trimmedMessage = String(message || "").trim();

    const missingFields = [];

    if (!trimmedUsername) missingFields.push("user name");
    if (!password) missingFields.push("password");
    if (!confirmPassword) missingFields.push("confirm password");
    if (!trimmedFullName) missingFields.push("full name");
    if (!trimmedCompanyName) missingFields.push("company name");
    if (!trimmedEmail) missingFields.push("email");
    if (!trimmedPhone) missingFields.push("phone number");

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please fill in all required fields: ${missingFields.join(", ")}.`
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password and confirm password do not match."
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message:
          "Account registration is temporarily unavailable. Please try again later."
      });
    }

    const idDb = readJson("iddatabase.json");

    if (idDb.suppliers[trimmedUsername]) {
      return res.status(409).json({
        success: false,
        message: "This user name is already taken."
      });
    }

    const existingUser = await findRegisteredUser(trimmedUsername);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This user name is already taken."
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { error: insertError } = await supabase.from(USERS_TABLE).insert({
      username: trimmedUsername,
      password_hash: passwordHash,
      full_name: trimmedFullName,
      company_name: trimmedCompanyName,
      email: trimmedEmail,
      phone: trimmedPhone,
      message: trimmedMessage
    });

    if (insertError) {
      if (isDuplicateUsernameError(insertError)) {
        return res.status(409).json({
          success: false,
          message: "This user name is already taken."
        });
      }

      console.error("Supabase register error:", insertError);
      return res.status(500).json({
        success: false,
        message: "Unable to create account right now. Please try again later."
      });
    }

    saveStoredUserData(trimmedUsername, [], null);

    return res.json({
      success: true,
      username: trimmedUsername
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to create account right now. Please try again later."
    });
  }
});

app.get("/api/account", async (req, res) => {
  try {
    const username = String(req.query.username || "").trim();

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "User name is required."
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: "Account service is temporarily unavailable."
      });
    }

    const user = await findRegisteredUser(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    const storedData = getStoredUserData(username);

    return res.json({
      success: true,
      username: user.username,
      profile: mapSupabaseUser(user),
      cart: storedData.cart || [],
      orderDraft: storedData.orderDraft || null
    });
  } catch (error) {
    console.error("Account lookup error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load account right now. Please try again later."
    });
  }
});

app.post("/api/user-data", async (req, res) => {
  try {
    const username = String(req.body.username || "").trim();
    const { cart, orderDraft } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "User name is required."
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: "Account service is temporarily unavailable."
      });
    }

    const user = await findRegisteredUser(username);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found."
      });
    }

    saveStoredUserData(username, cart, orderDraft);

    return res.json({ success: true });
  } catch (error) {
    console.error("User data save error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to save account data right now. Please try again later."
    });
  }
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