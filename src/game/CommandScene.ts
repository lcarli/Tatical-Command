import Phaser from 'phaser';
import type { PlayerView, Position } from '../simulation/core/types';
import { samePosition } from '../simulation/world/grid';
import { SEARCH_ROOM, TARGET_ROOM } from '../content/missions/blackwood';

export type ViewportBridge = {
  view: PlayerView;
  selected: string;
  onSelect: (id: string) => void;
  onTarget: (position: Position) => void;
};

const project = ({ x, y }: Position) => ({ x: 480 + (x - y) * 34, y: 78 + (x + y) * 19 });

export class CommandScene extends Phaser.Scene {
  private overlay: Phaser.GameObjects.Container | undefined;
  private previous: PlayerView | undefined;
  private selected = '';

  constructor(private readonly readBridge: () => ViewportBridge) {
    super('command');
  }

  create(): void {
    const { grid } = this.readBridge().view;
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        const position = { x, y };
        const screen = project(position);
        const wall = grid.walls.some((entry) => samePosition(entry, position));
        const objective = samePosition(position, TARGET_ROOM) || samePosition(position, SEARCH_ROOM);
        this.add.polygon(screen.x, screen.y, [0, -19, 34, 0, 0, 19, -34, 0], wall ? 0x33483d : objective ? 0x374b29 : 0x172b23)
          .setStrokeStyle(1, 0x52705c, 0.6)
          .setInteractive(new Phaser.Geom.Polygon([34, 0, 68, 19, 34, 38, 0, 19]), Phaser.Geom.Polygon.Contains)
          .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.leftButtonDown()) this.readBridge().onTarget(position);
          });
        if (wall) {
          this.add.polygon(screen.x, screen.y - 9, [0, -19, 34, 0, 0, 19, -34, 0], 0x4c6455).setStrokeStyle(1, 0x688372, 0.5);
        }
      }
    }
    for (const [position, label] of [[TARGET_ROOM, 'A / INSPECT'], [SEARCH_ROOM, 'B / SEARCH']] as const) {
      const screen = project(position);
      this.add.text(screen.x, screen.y + 22, label, { fontFamily: 'monospace', fontSize: '10px', color: '#e5d38c' }).setOrigin(0.5);
    }
    this.overlay = this.add.container(0, 0);
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom - dy * 0.001, 0.7, 1.8));
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
        this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
      }
    });
    this.renderView();
  }

  update(): void {
    const bridge = this.readBridge();
    if (bridge.view !== this.previous || bridge.selected !== this.selected) this.renderView();
  }

  private renderView(): void {
    const { view, selected } = this.readBridge();
    this.previous = view;
    this.selected = selected;
    const overlay = this.overlay;
    if (!overlay) return;
    overlay.removeAll(true);
    for (const intel of view.intel) {
      const screen = project(intel.position);
      const stale = intel.level === 'STALE';
      const marker = this.add.rectangle(screen.x, screen.y - 9, 17, 22, stale ? 0x596760 : intel.behavior === 'HOSTILE' || intel.behavior === 'THREATENING' ? 0xdb855f : 0xe7d386).setStrokeStyle(2, 0x121c16);
      overlay.add(marker);
      overlay.add(this.add.text(screen.x, screen.y - 36, `${intel.identity ?? 'CONTACT'}${stale ? ' ?' : ''}`, { fontFamily: 'monospace', fontSize: '10px', color: '#e7d386' }).setOrigin(0.5));
    }
    for (const operator of view.operators) {
      const screen = project(operator.position);
      const marker = this.add.circle(screen.x, screen.y - 10, selected === operator.id ? 13 : 10, operator.operational ? 0x81d0a4 : 0x915c56)
        .setStrokeStyle(selected === operator.id ? 3 : 1, selected === operator.id ? 0xe5f9ec : 0x284633)
        .setInteractive()
        .on('pointerdown', () => this.readBridge().onSelect(operator.id));
      overlay.add(marker);
      overlay.add(this.add.text(screen.x, screen.y - 34, operator.name.toUpperCase(), { fontFamily: 'monospace', fontSize: '11px', color: '#dcefe1' }).setOrigin(0.5));
      if (operator.action) {
        const elapsed = view.tick - operator.action.startedAt;
        const total = operator.action.endsAt - operator.action.startedAt;
        overlay.add(this.add.text(screen.x, screen.y + 12, `${operator.action.kind} ${Math.floor(elapsed * 100 / total)}%`, { fontFamily: 'monospace', fontSize: '10px', color: '#e7d386' }).setOrigin(0.5));
      }
    }
    for (const event of view.events.filter((entry) => entry.kind === 'IMPACT' && view.tick - entry.tick <= 3)) {
      if (!('targetId' in event)) continue;
      const contact = view.intel.find((entry) => entry.entityId === event.targetId);
      if (!contact) continue;
      const screen = project(contact.position);
      overlay.add(this.add.circle(screen.x, screen.y, 23, 0, 0).setStrokeStyle(2, 0xe9a26e, 0.8));
    }
  }
}
