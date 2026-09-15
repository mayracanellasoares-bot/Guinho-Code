export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function checkAABB(a: BoundingBox, b: BoundingBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function checkCircleAABB(
  cx: number,
  cy: number,
  radius: number,
  box: BoundingBox
): boolean {
  const closestX = Math.max(box.x, Math.min(cx, box.x + box.width));
  const closestY = Math.max(box.y, Math.min(cy, box.y + box.height));

  const distanceX = cx - closestX;
  const distanceY = cy - closestY;

  return distanceX * distanceX + distanceY * distanceY < radius * radius;
}

export function checkCollisionEntities(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  if (!a || !b) return false;
  return checkAABB(a, b);
}
