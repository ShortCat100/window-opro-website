function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showAccountView() {
  document.getElementById("registerSection").style.display = "none";
  document.getElementById("accountSection").style.display = "block";
  document.getElementById("pageTitle").innerText = "My Account";
}

function showRegisterView() {
  document.getElementById("registerSection").style.display = "block";
  document.getElementById("accountSection").style.display = "none";
  document.getElementById("pageTitle").innerText = "Create a New Account";
}

async function loadAccountDashboard() {
  const username = getUsername();
  const response = await fetch(
    `/api/account?username=${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    document.getElementById("accountContent").innerHTML =
      "<p>Unable to load account information.</p>";
    return;
  }

  const data = await response.json();
  const profile = data.profile || {};
  const cart = data.cart || [];
  const draft = data.orderDraft;

  let html = `
    <div class="account-profile">
      <p><strong>User Name:</strong> ${username}</p>
      <p><strong>Full Name:</strong> ${profile.fullName || ""}</p>
      <p><strong>Company:</strong> ${profile.companyName || ""}</p>
      <p><strong>Email:</strong> ${profile.email || ""}</p>
      <p><strong>Phone:</strong> ${profile.phone || ""}</p>
    </div>
  `;

  if (draft && draft.rows) {
    const filledRows = draft.rows.filter(row => row.numWindows).length;
    html += `
      <div class="account-block">
        <h2>Saved Design Draft</h2>
        <p>You have a design draft in progress with ${filledRows} configured row(s).</p>
        <a href="order.html" class="account-action-link">Continue Design</a>
      </div>
    `;
  } else {
    html += `
      <div class="account-block">
        <h2>Saved Design Draft</h2>
        <p>No design draft saved yet.</p>
      </div>
    `;
  }

  if (cart.length === 0) {
    html += `
      <div class="account-block">
        <h2>Saved Quotes</h2>
        <p>No saved projects in your cart yet.</p>
      </div>
    `;
  } else {
    html += `<div class="account-block"><h2>Saved Quotes (${cart.length})</h2>`;

    cart.forEach((project, index) => {
      html += `
        <div class="account-project">
          <h3>Project ${index + 1}</h3>
          <p>Quote: $${formatMoney(project.quote)}</p>
          <p>Total: $${formatMoney(project.total)}</p>
        </div>
      `;
    });

    html += `<a href="cart.html" class="account-action-link">View Full Cart</a></div>`;
  }

  document.getElementById("accountContent").innerHTML = html;
}

async function registerAccount() {
  const registerMessage = document.getElementById("registerMessage");
  registerMessage.innerText = "";

  const payload = {
    username: document.getElementById("regUsername").value.trim(),
    password: document.getElementById("regPassword").value,
    confirmPassword: document.getElementById("regConfirmPassword").value,
    fullName: document.getElementById("regFullName").value.trim(),
    companyName: document.getElementById("regCompanyName").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    phone: document.getElementById("regPhone").value.trim(),
    message: document.getElementById("regMessage").value.trim()
  };

  const response = await fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    registerMessage.innerText = data.message || "Registration failed.";
    return;
  }

  registerMessage.innerText =
    "Account created successfully. You can now sign in with your user name and password.";
  document.getElementById("registerForm").reset();
}

window.addEventListener("load", async () => {
  if (isGuestUser()) {
    showRegisterView();
    document.getElementById("accountIntro").innerText =
      "Guest access is limited to fast quote only. Please register for full features like saving projects and submitting quotes.";
    return;
  }

  if (isRegisteredUser()) {
    showAccountView();
    await loadAccountDashboard();
    return;
  }

  showRegisterView();
});
