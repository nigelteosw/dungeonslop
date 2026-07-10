import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShipViewState } from '../net/schemaAdapter';

interface AudioSnapshot { hull: number; fires: number; boarders: number; status: string; }

export function useShipAudio(state: ShipViewState) {
  const contextRef = useRef<AudioContext | null>(null);
  const previousRef = useRef<AudioSnapshot | null>(null);
  const [enabled, setEnabled] = useState(false);

  const tone = useCallback((frequency: number, duration = 0.12, type: OscillatorType = 'sine') => {
    const context = contextRef.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }, []);

  const toggle = useCallback(async () => {
    if (enabled) { setEnabled(false); return; }
    const AudioContextClass = window.AudioContext;
    contextRef.current ??= new AudioContextClass();
    await contextRef.current.resume();
    setEnabled(true);
    tone(520, 0.08);
  }, [enabled, tone]);

  useEffect(() => {
    const current = {
      hull: state.hull,
      fires: Object.keys(state.fires).length,
      boarders: Object.keys(state.boarders).length,
      status: state.status,
    };
    const previous = previousRef.current;
    if (enabled && previous) {
      if (current.hull < previous.hull) tone(82, 0.3, 'sawtooth');
      if (current.fires > previous.fires) tone(180, 0.2, 'square');
      if (current.boarders > previous.boarders) tone(620, 0.12, 'square');
      if (current.status !== previous.status && current.status.includes('Vote')) tone(420, 0.16);
      if (current.status === 'victory' && previous.status !== 'victory') {
        tone(440, 0.14); window.setTimeout(() => tone(660, 0.25), 150);
      }
    }
    previousRef.current = current;
  }, [enabled, state, tone]);

  return { enabled, toggle };
}
