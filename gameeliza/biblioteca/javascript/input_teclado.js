const keys = new Set();
addEventListener("keydown", event => {
  keys.add(event.key.toLowerCase());
  if (["arrowleft", "arrowright", " "].includes(event.key.toLowerCase())) event.preventDefault();
});
addEventListener("keyup", event => keys.delete(event.key.toLowerCase()));
export function axis() {
  return (keys.has("arrowright") || keys.has("d") ? 1 : 0)
       - (keys.has("arrowleft") || keys.has("a") ? 1 : 0);
}
