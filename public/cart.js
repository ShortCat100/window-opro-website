
function formatMoney(value) {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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
          <td>${row.glassPattern}</td>
          <td>${row.addings}</td>
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

loadCart();

function confirmDeleteProject(index) {
  const confirmed = confirm(`Selected project ${index + 1} will be deleted.`);

  if (!confirmed) return;

  let cart = JSON.parse(localStorage.getItem("windowCart")) || [];
  cart.splice(index, 1);
  localStorage.setItem("windowCart", JSON.stringify(cart));

  loadCart();
}