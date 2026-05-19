

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("windowCart")) || [];

  document.querySelectorAll(".cart-count").forEach(el => {
    el.innerText = cart.length > 0 ? cart.length : "";
  });
}

window.addEventListener("load", updateCartCount);