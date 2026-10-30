import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { CommandScene } from './CommandScene';
import type { ViewportBridge } from './CommandScene';

export function GameViewport(props: ViewportBridge) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bridge = useRef(props);

  useEffect(() => {
    bridge.current = props;
  }, [props]);

  useEffect(() => {
    const parent = containerRef.current;
    if (!parent) {
      throw new Error('Game viewport element is missing.');
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: 960,
      height: 540,
      backgroundColor: '#101916',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [new CommandScene(() => bridge.current)],
      audio: { noAudio: true },
      banner: false,
    });

    return () => {
      // Remove the old canvas immediately, including during StrictMode's effect replay.
      game.destroy(true);
      parent.replaceChildren();
    };
  }, []);

  return (
    <div
      className="game-viewport"
      ref={containerRef}
      role="img"
      aria-label="Blackwood command map. Select an operator, then a tile. Equivalent controls are available alongside the map."
      data-testid="game-viewport"
    />
  );
}
