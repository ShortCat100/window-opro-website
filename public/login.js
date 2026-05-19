async function login() {
  const supplierId = document.getElementById("supplierId").value.trim();
  const verifyCode = document.getElementById("verifyCode").value.trim();

  const response = await fetch("/api/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      supplierId,
      verifyCode
    })
  });

  if (response.ok) {
    sessionStorage.setItem("loggedIn", "true");
    window.location.href = "order.html";
  } else {
    document.getElementById("loginMessage").innerText =
      "Supplier ID or verification code is incorrect.";
  }
}

function goToDesign(event) {
  event.preventDefault();

  if (sessionStorage.getItem("loggedIn") === "true") {
    window.location.href = "order.html";
  } else {
    document.getElementById("signinDialog").style.display = "flex";
  }
}

function closeSigninDialog() {
  document.getElementById("signinDialog").style.display = "none";
}




