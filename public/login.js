async function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const loginMessage = document.getElementById("loginMessage");

  if (!username || !password) {
    loginMessage.innerText = "Please enter your user name and password.";
    return;
  }

  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      username,
      password
    })
  });

  const data = await response.json();

  if (!response.ok) {
    loginMessage.innerText =
      data.message || "User name or password is incorrect.";
    return;
  }

  sessionStorage.setItem("loggedIn", "true");
  sessionStorage.setItem("username", data.username);

  if (data.guest) {
    sessionStorage.setItem("guestMode", "true");
    sessionStorage.setItem("showGuestWelcome", "true");
    localStorage.removeItem("windowCart");
    localStorage.removeItem("currentOrderDraft");
  } else {
    sessionStorage.removeItem("guestMode");
    sessionStorage.removeItem("showGuestWelcome");
    await loadUserData(data.username);
  }

  window.location.href = "order.html";
}
