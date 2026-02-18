const toast = document.getElementById("toast");
let toastTimer;

export function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 1800);
}

export function showError(message) {
  alert(message);
}
