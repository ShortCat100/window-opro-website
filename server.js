
const multer = require("multer");
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const { createClient } = require("@supabase/supabase-js");
const {
  appendCartSubmissionRows,
  isGoogleSheetsConfigured
} = require("./lib/googleSheets");

const express = require("express");
const fs = require("fs");
const path = require("path");

const BCRYPT_ROUNDS = 10;
const USERS_TABLE = "users";
const CART_SUBMISSION_ROWS_TABLE = "cart_submission_rows";

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

const GLASS_LABELS = {
  "0": "Clear",
  "1": "Mist",
  Rain: "Rain"
};

const ADDING_LABELS = {
  "0": "None",
  "1": "acc 1"
};

function formatCartSize(number, fraction) {
  const fractionMap = {
    "0.125": "1/8",
    "0.25": "1/4",
    "0.375": "3/8",
    "0.5": "1/2",
    "0.625": "5/8",
    "0.75": "3/4",
    "0.875": "7/8"
  };

  if (!fraction || fraction === "0" || fraction === 0) {
    return String(number ?? "");
  }

  const fracStr = fractionMap[String(fraction)] || String(fraction);
  return `${number}-${fracStr}`;
}

function displayGlassType(value) {
  return GLASS_LABELS[value] || value || "";
}

function displayAdding(value) {
  return ADDING_LABELS[value] || value || "";
}

function computeCartOrderTotals(cart) {
  let totalDiscount = 0;
  let totalCost = 0;

  cart.forEach(project => {
    const total = Number(project.total) || 0;
    const discountQuote = Number(project.discountQuote) || 0;

    if (discountQuote > 0) {
      totalDiscount += total - discountQuote;
      totalCost += discountQuote;
    } else {
      totalCost += total;
    }
  });

  return {
    discount: Number(totalDiscount.toFixed(2)),
    totalCost: Number(totalCost.toFixed(2))
  };
}

function formatSubmissionTime(date) {
  const d = date || new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${mm}/${dd}/${yyyy} ${hours}:${minutes}`;
}

function flattenCartToSubmissionRows(cart, user, submissionTime, orderTotals) {
  const records = [];

  cart.forEach(project => {
    const rows = Array.isArray(project.rows) ? project.rows : [];
    const rowCosts = Array.isArray(project.rowCosts) ? project.rowCosts : [];

    rows.forEach((row, index) => {
      if (!row.numWindows) {
        return;
      }

      records.push({
        submission_time: submissionTime,
        email: user.email,
        full_name: user.full_name,
        company_name: user.company_name,
        num_windows: row.numWindows ?? "",
        height_inch: formatCartSize(row.height, row.heightFraction),
        width_inch: formatCartSize(row.width, row.widthFraction),
        openings: row.openings ?? "",
        glass_type: displayGlassType(row.glassPattern),
        adding: displayAdding(row.addings),
        cost: rowCosts[index] || "",
        discount: orderTotals.discount,
        total_cost: orderTotals.totalCost
      });
    });
  });

  return records;
}

async function saveCartSubmissionsToSupabase(username, cart) {
  if (!supabase) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  const user = await findRegisteredUser(username);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const submissionTime = formatSubmissionTime(new Date());
  const orderTotals = computeCartOrderTotals(cart);
  const records = flattenCartToSubmissionRows(
    cart,
    user,
    submissionTime,
    orderTotals
  );

  if (records.length === 0) {
    throw new Error("NO_CART_ROWS");
  }

  const { error } = await supabase
    .from(CART_SUBMISSION_ROWS_TABLE)
    .insert(records);

  if (error) {
    throw error;
  }

  return {
    submissionTime,
    rowCount: records.length,
    records
  };
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
    const username = String(req.body.username || "").trim();
    const cart = JSON.parse(req.body.cart || "[]");

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "User name is required to submit projects."
      });
    }

    if (!Array.isArray(cart) || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No projects in cart to submit."
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        message: "Project submission is temporarily unavailable."
      });
    }

    const savedSubmission = await saveCartSubmissionsToSupabase(username, cart);

    // Email submission is pending until SMTP is configured.

    let sheetResult = { skipped: true };

    try {
      sheetResult = await appendCartSubmissionRows(savedSubmission.records);
    } catch (sheetError) {
      console.error("Google Sheets error:", sheetError);

      if (isGoogleSheetsConfigured()) {
        throw new Error("GOOGLE_SHEETS_FAILED");
      }
    }

    res.json({
      success: true,
      submissionTime: savedSubmission.submissionTime,
      rowCount: savedSubmission.rowCount,
      googleSheets: sheetResult
    });
  } catch (error) {
    console.error("Submit cart error:", error);

    if (error.message === "GOOGLE_SHEETS_FAILED") {
      return res.status(500).json({
        success: false,
        message:
          "Saved to database, but Google Sheets update failed. Please contact support."
      });
    }

    if (error.message === "NO_CART_ROWS") {
      return res.status(400).json({
        success: false,
        message: "No window rows found to submit."
      });
    }

    if (error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Account not found. Please sign in again."
      });
    }

    if (error.message === "SUPABASE_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message: "Project submission is temporarily unavailable."
      });
    }

    return res.status(500).json({
      success: false,
      message: "Submission failed. Please try again or contact us directly."
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});