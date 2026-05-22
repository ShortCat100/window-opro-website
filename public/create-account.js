function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderSubmissionHistory(submissions) {
  if (!submissions.length) {
    return `
      <div class="account-block">
        <h2>Submission History</h2>
        <p>No submitted quotes yet.</p>
      </div>
    `;
  }

  let html = `
    <div class="account-block">
      <h2>Submission History (${submissions.length})</h2>
  `;

  submissions.forEach(submission => {
    html += `
      <div class="account-submission">
        <h3>Submitted ${escapeHtml(submission.submissionTime)}</h3>
        <p><strong>Discount:</strong> $${formatMoney(submission.discount)}</p>
        <p><strong>Total Cost:</strong> $${formatMoney(submission.totalCost)}</p>

        <table class="cart-table account-history-table">
          <tr>
            <th>Number of Windows</th>
            <th>Height-inch</th>
            <th>Width-inch</th>
            <th>Opening Number</th>
            <th>Glass Type</th>
            <th>Adding</th>
            <th>Cost</th>
          </tr>
    `;

    submission.lineItems.forEach(line => {
      html += `
        <tr>
          <td>${escapeHtml(line.numWindows)}</td>
          <td>${escapeHtml(line.heightInch)}</td>
          <td>${escapeHtml(line.widthInch)}</td>
          <td>${escapeHtml(line.openings)}</td>
          <td>${escapeHtml(line.glassType)}</td>
          <td>${escapeHtml(line.adding)}</td>
          <td>${escapeHtml(line.cost)}</td>
        </tr>
      `;
    });

    html += `
        </table>
      </div>
    `;
  });

  html += `</div>`;
  return html;
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
  const submissionHistory = data.submissionHistory || [];

  let html = `
    <div class="account-profile">
      <p><strong>User Name:</strong> ${escapeHtml(username)}</p>
      <p><strong>Full Name:</strong> ${escapeHtml(profile.fullName || "")}</p>
      <p><strong>Company:</strong> ${escapeHtml(profile.companyName || "")}</p>
      <p><strong>Email:</strong> ${escapeHtml(profile.email || "")}</p>
      <p><strong>Phone:</strong> ${escapeHtml(profile.phone || "")}</p>
    </div>
  `;

  html += renderSubmissionHistory(submissionHistory);

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
        <h2>Quotes in Cart (not submitted)</h2>
        <p>No saved projects in your cart.</p>
      </div>
    `;
  } else {
    html += `<div class="account-block"><h2>Quotes in Cart (${cart.length}) — not submitted</h2>`;

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

let registerToastTimer = null;

function showRegisterToast(message, isError) {
  const toast = document.getElementById("registerToast");
  const toastMessage = document.getElementById("registerToastMessage");

  toastMessage.innerText = message;
  toast.classList.toggle("register-toast-error", Boolean(isError));
  toast.style.display = "block";

  if (registerToastTimer) {
    clearTimeout(registerToastTimer);
  }

  registerToastTimer = setTimeout(() => {
    toast.style.display = "none";
  }, 4500);
}

async function registerAccount() {
  const registerMessage = document.getElementById("registerMessage");
  const submitButton = document.querySelector("#registerForm button[type='submit']");

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

  submitButton.disabled = true;
  submitButton.innerText = "Creating Account...";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.message || "Registration failed.";
      registerMessage.innerText = errorMessage;
      showRegisterToast(errorMessage, true);
      return;
    }

    document.getElementById("registerForm").reset();
    registerMessage.innerText = "";
    showRegisterToast(
      "Your account is created. A confirmation is sent to your email.",
      false
    );
  } catch (error) {
    console.error(error);
    const errorMessage =
      "Unable to create account right now. Please check your connection and try again.";
    registerMessage.innerText = errorMessage;
    showRegisterToast(errorMessage, true);
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = "Create Account";
  }
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
