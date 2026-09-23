export async function requestJson(url, options = {}) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, ...options });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}
