import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShipViewState } from '../net/schemaAdapter';

interface AudioSnapshot {
  hull: number;
  fires: number;
  boarders: number;
  status: string;
  breaches: number;
  lowOxygen: boolean;
  weaponReady: boolean;
  incomingVolley: boolean;
  incapacitated: number;
}

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
      breaches: Object.values(state.rooms).filter((room) => room.breached).length,
      lowOxygen: Object.values(state.rooms).some((room) => room.oxygen <= 20),
      weaponReady: state.weaponChargeTicks >= state.weaponChargeMaxTicks && state.weaponChargeMaxTicks > 0,
      incomingVolley: state.enemyWeaponChargeMaxTicks > 0 && state.enemyWeaponChargeTicks / state.enemyWeaponChargeMaxTicks >= 0.8,
      incapacitated: Object.values(state.crew).filter((crew) => crew.incapacitated).length,
    };
    const previous = previousRef.current;
    if (enabled && previous) {
      if (current.hull < previous.hull) tone(82, 0.3, 'sawtooth');
      if (current.fires > previous.fires) tone(180, 0.2, 'square');
      if (current.breaches > previous.breaches) tone(140, 0.25, 'sawtooth');
      if (current.boarders > previous.boarders) tone(620, 0.12, 'square');
      if (current.lowOxygen && !previous.lowOxygen) tone(300, 0.35, 'triangle');
      if (current.weaponReady && !previous.weaponReady) tone(760, 0.1);
      if (current.incomingVolley && !previous.incomingVolley) tone(220, 0.4, 'sawtooth');
      if (current.incapacitated > previous.incapacitated) tone(90, 0.4, 'square');
      if (current.status !== previous.status && current.status.includes('Vote')) tone(420, 0.16);
      if (current.status === 'victory' && previous.status !== 'victory') {
        tone(440, 0.14); window.setTimeout(() => tone(660, 0.25), 150);
      }
      if (current.status === 'defeat' && previous.status !== 'defeat') {
        tone(220, 0.3, 'sawtooth'); window.setTimeout(() => tone(110, 0.5, 'sawtooth'), 180);
      }
    }
    previousRef.current = current;
  }, [enabled, state, tone]);

  return { enabled, toggle };
}
