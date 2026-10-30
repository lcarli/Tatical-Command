import type { Grid, Position } from '../core/types';

export const positionKey = (position: Position): string => `${position.x},${position.y}`;
export const samePosition = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;
export const distance = (a: Position, b: Position): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const inGrid = (grid: Grid, p: Position): boolean =>
  Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < grid.width && p.y < grid.height;
export const walkable = (grid: Grid, p: Position): boolean =>
  inGrid(grid, p) && !grid.walls.some((wall) => samePosition(wall, p));

export function findPath(grid: Grid, start: Position, goal: Position, occupied: readonly Position[] = []): readonly Position[] | null {
  if (!walkable(grid, goal)) return null;
  const blocked = new Set(occupied.map(positionKey));
  blocked.delete(positionKey(start));
  const open = [{ position: start, cost: 0, path: [] as Position[] }];
  const best = new Map<string, number>([[positionKey(start), 0]]);
  while (open.length > 0) {
    open.sort((a, b) => (a.cost + distance(a.position, goal)) - (b.cost + distance(b.position, goal))
      || a.position.y - b.position.y || a.position.x - b.position.x);
    const current = open.shift();
    if (!current) break;
    if (samePosition(current.position, goal)) return current.path;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const position = { x: current.position.x + dx, y: current.position.y + dy };
      const cost = current.cost + 1;
      if (!walkable(grid, position) || blocked.has(positionKey(position)) || cost >= (best.get(positionKey(position)) ?? Infinity)) continue;
      best.set(positionKey(position), cost);
      open.push({ position, cost, path: [...current.path, position] });
    }
  }
  return null;
}
