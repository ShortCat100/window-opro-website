function isLoggedIn() {
  return sessionStorage.getItem("loggedIn") === "true";
}

function isGuestUser() {
  return sessionStorage.getItem("guestMode") === "true";
}

function isRegisteredUser() {
  return isLoggedIn() && !isGuestUser();
}

function getUsername() {
  return sessionStorage.getItem("username") || "";
}

async function loadUserData(username) {
  const response = await fetch(
    `/api/account?username=${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    return;
  }

  const data = await response.json();
  localStorage.setItem("windowCart", JSON.stringify(data.cart || []));

  if (data.orderDraft) {
    localStorage.setItem("currentOrderDraft", JSON.stringify(data.orderDraft));
  } else {
    localStorage.removeItem("currentOrderDraft");
  }

  if (typeof updateCartCount === "function") {
    updateCartCount();
  }
}

async function saveUserData() {
  const username = getUsername();

  if (!isRegisteredUser()) {
    return;
  }

  await fetch("/api/user-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      cart: JSON.parse(localStorage.getItem("windowCart") || "[]"),
      orderDraft: JSON.parse(localStorage.getItem("currentOrderDraft") || "null")
    })
  });
}

function goToDesign(event) {
  event.preventDefault();

  if (isLoggedIn()) {
    window.location.href = "order.html";
    return;
  }

  const signinDialog = document.getElementById("signinDialog");
  if (signinDialog) {
    signinDialog.style.display = "flex";
  } else {
    alert("Please sign in first.");
  }
}

function closeSigninDialog() {
  const signinDialog = document.getElementById("signinDialog");
  if (signinDialog) {
    signinDialog.style.display = "none";
  }
}

function showRegisterPrompt() {
  const dialog = document.getElementById("registerPromptDialog");
  if (dialog) {
    dialog.style.display = "flex";
    return;
  }

  alert(
    "Please register to save projects, submit quotes, and access your full account."
  );
}

function closeRegisterPrompt() {
  const dialog = document.getElementById("registerPromptDialog");
  if (dialog) {
    dialog.style.display = "none";
  }
}

function showGuestWelcomeDialog() {
  const dialog = document.getElementById("guestWelcomeDialog");
  if (dialog) {
    dialog.style.display = "flex";
  }
}

function closeGuestWelcomeDialog() {
  const dialog = document.getElementById("guestWelcomeDialog");
  if (dialog) {
    dialog.style.display = "none";
  }
}
