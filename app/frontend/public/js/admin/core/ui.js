const TOAST_TYPES = new Set(["info", "success", "warning"]);

export function showToast(message, type = "info") {
  if (typeof window.Toastify !== "function") return;

  const normalizedType = TOAST_TYPES.has(type) ? type : "info";

  window.Toastify({
    text: String(message ?? ""),
    duration: 1800,
    gravity: "top",
    position: "right",
    stopOnFocus: true,
    className: `admin-toast admin-toast--${normalizedType}`,
    offset: {
      x: 20,
      y: 20
    }
  }).showToast();
}

export function showError(message) {
  alert(message);
}
