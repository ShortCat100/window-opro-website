window.onload = function () {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  if (sessionStorage.getItem("showGuestWelcome") === "true") {
    showGuestWelcomeDialog();
    sessionStorage.removeItem("showGuestWelcome");
  }

  createRows();
  loadOrderDraft();
  setupAutoSaveDraft();
  updateCartCount();
};

function createRows() {
  const tbody = document.getElementById("windowRows");

  const fractions = [
    { text: "0", value: 0 },
    { text: "1/2", value: 0.5 },
    { text: "1/4", value: 0.25 },
    { text: "1/8", value: 0.125 },
    { text: "3/4", value: 0.75 },
    { text: "3/8", value: 0.375 },
    { text: "5/8", value: 0.625 },
    { text: "7/8", value: 0.875 }
  ];

const glassPatterns = [
  { text: "Clear", value: 0 },
  { text: "Mist", value: 1 },
  { text: "Rain", value: 1 }
];

const addings = [
  { text: "None", value: 0 },
  { text: "acc 1", value: 1 },
  { text: "acc 2", value: 1 }
];

  for (let i = 0; i < 7; i++) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td><input type="number" class="numWindows"></td>
      <td><input type="number" class="height"></td>
      <td>${makeSelect("heightFraction", fractions)}</td>
      <td><input type="number" class="width"></td>
      <td>${makeSelect("widthFraction", fractions)}</td>
      <td><input type="number" class="openings"></td>
      <td>${makeSelect("glassPattern", glassPatterns)}</td>
      <td>${makeSelect("addings", addings)}</td>
      <td class="row-cost">$0.00</td>  

    `;

    tbody.appendChild(row);
  }
}

function makeSelect(className, options) {
  let html = `<select class="${className}">`;

  options.forEach(option => {
    html += `<option value="${option.value}">${option.text}</option>`;
  });

  html += `</select>`;
  return html;
}

function collectRows() {
  const rows = [];
  const tableRows = document.querySelectorAll("#windowRows tr");

  tableRows.forEach(row => {
    rows.push({
      numWindows: row.querySelector(".numWindows").value,
      height: row.querySelector(".height").value,
      heightFraction: row.querySelector(".heightFraction").value,
      width: row.querySelector(".width").value,
      widthFraction: row.querySelector(".widthFraction").value,
      openings: row.querySelector(".openings").value,
      glassPattern: row.querySelector(".glassPattern").value,
      addings: row.querySelector(".addings").value
    });
  });

  return rows;
}

async function evaluateQuote() {
  const rows = collectRows();
  const promotionCode = document.getElementById("promotionCode").value.trim();

  const response = await fetch("/api/quote", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      rows,
      promotionCode
    })
  });

  const result = await response.json();

  const costCells = document.querySelectorAll(".row-cost");
  costCells.forEach((cell, index) => {
    cell.innerText = result.rowCosts[index]
      ? "$" + result.rowCosts[index]
      : "$0.00";
  });


document.getElementById("quote").value = result.quote;
document.getElementById("tax").value = result.tax;
document.getElementById("total").value = result.total;
document.getElementById("discountQuote").value =
  result.discountTotal || "0";
}



document.addEventListener("change", function (event) {
  if (event.target.id === "designFiles") {
    const files = Array.from(event.target.files);

    const fileNamesBox = document.getElementById("fileNames");

    if (files.length === 0) {
      fileNamesBox.innerText = "No files selected";
    } else {
      fileNamesBox.innerHTML = files
        .map(file => `<div>${file.name}</div>`)
        .join("");
    }
  }
});

function openSubmitDialog() {
  document.getElementById("submitDialog").style.display = "flex";
}

function closeSubmitDialog() {
  document.getElementById("submitDialog").style.display = "none";
}

async function submitProject() {
  const rows = collectRows();
  const promotionCode = document.getElementById("promotionCode").value.trim();

  const formData = new FormData();

  formData.append("rows", JSON.stringify(rows));
  formData.append("promotionCode", promotionCode);
  formData.append("quote", document.getElementById("quote").value);
  formData.append("tax", document.getElementById("tax").value);
  formData.append("total", document.getElementById("total").value);
  formData.append("discountQuote", document.getElementById("discountQuote").value);

  const files = document.getElementById("designFiles").files;

  for (let i = 0; i < files.length; i++) {
    formData.append("designFiles", files[i]);
  }

  const response = await fetch("/api/submit-project", {
    method: "POST",
    body: formData
  });

  if (response.ok) {
    alert("Project submitted successfully.");
    closeSubmitDialog();
  } else {
    alert("Submission failed. Please contact us directly.");
  }
}

//dialog - start new project in order page

function confirmNewProject() {
  document.getElementById("confirmDialog").style.display = "flex";
}

function closeDialog() {
  document.getElementById("confirmDialog").style.display = "none";
}

async function proceedNewProject() {
  localStorage.removeItem("currentOrderDraft");
  await saveUserData();
  location.reload();
}


async function saveProjectToCart() {
  if (!isRegisteredUser()) {
    showRegisterPrompt();
    return;
  }

  await evaluateQuote();

  const rows = collectRows();
  const rowCosts = Array.from(document.querySelectorAll(".row-cost"))
    .map(cell => cell.innerText);

  const project = {
    rows: rows,
    rowCosts: rowCosts,
    quote: document.getElementById("quote").value,
    tax: document.getElementById("tax").value,
    total: document.getElementById("total").value,
    discountQuote: document.getElementById("discountQuote").value,
    promotionCode: document.getElementById("promotionCode").value.trim()
  };

  let cart = JSON.parse(localStorage.getItem("windowCart")) || [];
  cart.push(project);

  localStorage.setItem("windowCart", JSON.stringify(cart));

  await saveUserData();
  showCartMessage();
  updateCartCount();
}

function showCartMessage() {
  const messageBox = document.getElementById("cartMessage");

  if (!messageBox) {
    console.error("cartMessage element not found");
    return;
  }

  messageBox.style.display = "flex";

  setTimeout(() => {
    messageBox.style.display = "none";
  }, 2000);
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("windowCart")) || [];
  const countElements = document.querySelectorAll(".cart-count");

  countElements.forEach(element => {
    element.innerText = cart.length;
  });
}

window.addEventListener("load", updateCartCount);

function saveOrderDraft() {
  const draft = {
    rows: collectRows(),
    promotionCode: document.getElementById("promotionCode")?.value || ""
  };

  localStorage.setItem("currentOrderDraft", JSON.stringify(draft));

  if (isRegisteredUser()) {
    saveUserData();
  }
}

function loadOrderDraft() {
  const draft = JSON.parse(localStorage.getItem("currentOrderDraft"));

  if (!draft) return;

  const tableRows = document.querySelectorAll("#windowRows tr");

  tableRows.forEach((tableRow, index) => {
    const savedRow = draft.rows[index];
    if (!savedRow) return;

    tableRow.querySelector(".numWindows").value = savedRow.numWindows || "";
    tableRow.querySelector(".height").value = savedRow.height || "";
    tableRow.querySelector(".heightFraction").value = savedRow.heightFraction || "0";
    tableRow.querySelector(".width").value = savedRow.width || "";
    tableRow.querySelector(".widthFraction").value = savedRow.widthFraction || "0";
    tableRow.querySelector(".openings").value = savedRow.openings || "";
    tableRow.querySelector(".glassPattern").value = savedRow.glassPattern || "0";
    tableRow.querySelector(".addings").value = savedRow.addings || "0";
  });

  document.getElementById("promotionCode").value = draft.promotionCode || "";
}

function setupAutoSaveDraft() {
  document.addEventListener("input", saveOrderDraft);
  document.addEventListener("change", saveOrderDraft);
}