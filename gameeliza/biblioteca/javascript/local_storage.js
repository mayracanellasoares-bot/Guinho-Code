export function saveState(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
export function loadState(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
