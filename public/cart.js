
function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

function displayGlassType(value) {
  return GLASS_LABELS[value] || value || "";
}

function displayAdding(value) {
  return ADDING_LABELS[value] || value || "";
}

function formatSize(number, fraction) {
  if (!fraction || fraction === "0" || fraction === 0) return number;

  const fractionMap = {
    "0.125": "1/8",
    "0.25": "1/4",
    "0.375": "3/8",
    "0.5": "1/2",
    "0.625": "5/8",
    "0.75": "3/4",
    "0.875": "7/8"
  };

  const key = String(fraction);
  const fracStr = fractionMap[key] || key;

  return `${number}-${fracStr}`;
}

window.addEventListener("load", () => {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
    return;
  }

  if (!isRegisteredUser()) {
    document.getElementById("cartProjects").innerHTML =
      "<p>Guest access cannot view saved cart projects. Please register for full account features.</p>";
    document.querySelector(".cart-submit-row")?.style.setProperty("display", "none");
    document.querySelector(".cart-upload-box")?.style.setProperty("display", "none");
    return;
  }

  loadCart();
});

function loadCart() {
  const cart = JSON.parse(localStorage.getItem("windowCart")) || [];
  const container = document.getElementById("cartProjects");

  if (cart.length === 0) {
    container.innerHTML = "<p>No projects saved in cart.</p>";
    return;
  }

  container.innerHTML = "";
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalCost = 0;

  cart.forEach((project, projectIndex) => {
    let html = `
      <div class="cart-project">
        <div class="cart-project-title">
            <h2>Project ${projectIndex + 1}</h2>
            <button onclick="confirmDeleteProject(${projectIndex})">Delete</button>
        </div>
      
    
        <table class="cart-table">
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

    project.rows.forEach((row, rowIndex) => {
      if (!row.numWindows) return;

      html += `
        <tr>
          <td>${row.numWindows}</td>
          <td>${formatSize(row.height, row.heightFraction)}</td>
          <td>${formatSize(row.width, row.widthFraction)}</td>
          <td>${row.openings}</td>
          <td>${displayGlassType(row.glassPattern)}</td>
          <td>${displayAdding(row.addings)}</td>
          <td>${project.rowCosts[rowIndex] || "$0.00"}</td>
        </tr>
      `;
    });

    html += `
        </table>

        <div class="cart-summary">
        <p>Quote: $${formatMoney(project.quote)}</p>
        </div>


      </div>
    `;

    container.innerHTML += html;

    const quote = Number(project.quote) || 0;
    const tax = Number(project.tax) || 0;
    const total = Number(project.total) || 0;
    const discountQuote = Number(project.discountQuote) || 0;

    subtotal += quote;
    totalTax += tax;

    if (discountQuote > 0) {
    totalDiscount += total - discountQuote;
    totalCost += discountQuote;
    } else {
    totalCost += total;
    }

  });

container.innerHTML += `
  <div class="cart-final-summary">
    <h2>Order Summary</h2>
    <p>Sub Total: $${formatMoney(subtotal)} </p>
    <p>Tax: $${formatMoney(totalTax)} </p>
    <p>Discount: $${formatMoney(totalDiscount)} </p>
    <p><strong>Total Cost: $${formatMoney(totalCost)}  </strong></p>
  </div>
`;

}

function confirmDeleteProject(index) {
  const confirmed = confirm(`Selected project ${index + 1} will be deleted.`);

  if (!confirmed) return;

  let cart = JSON.parse(localStorage.getItem("windowCart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("windowCart", JSON.stringify(cart));

  saveUserData();
  loadCart();
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
  if (!isRegisteredUser()) {
    showRegisterPrompt();
    return;
  }

  const submitButton = document.querySelector("#submitDialog .dialog-buttons button:last-child");
  submitButton.disabled = true;
  submitButton.innerText = "Submitting...";

  try {
    const cart = JSON.parse(localStorage.getItem("windowCart")) || [];

    if (cart.length === 0) {
      alert("No projects in cart.");
      return;
    }

    const formData = new FormData();
    formData.append("username", getUsername());
    formData.append("cart", JSON.stringify(cart));

    const files = document.getElementById("designFiles").files;

    for (let i = 0; i < files.length; i++) {
      formData.append("designFiles", files[i]);
    }

    const response = await fetch("/api/submit-cart", {
      method: "POST",
      body: formData
    });

    const result = await response.json();

    if (response.ok) {
      alert(
        `All projects submitted successfully. ${result.rowCount || 0} row(s) saved.`
      );
      localStorage.removeItem("windowCart");
      await saveUserData();
      closeSubmitDialog();
      location.reload();
    } else {
      alert(result.message || "Submission failed. Please contact us directly.");
    }
  } catch (error) {
    console.error(error);
    alert("Submission failed. Please check your connection or contact us directly.");
  } finally {
    submitButton.disabled = false;
    submitButton.innerText = "Submit";
  }
}