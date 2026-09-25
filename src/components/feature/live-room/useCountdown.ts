import { useEffect, useState } from "react";

interface TimeLeft {
  hours: number;
  minutes: number;
  seconds: number;
}

function timeLeftUntil(targetMs: number): TimeLeft {
  const diff = Math.max(0, targetMs - Date.now());
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
  };
}

/** Cuenta regresiva hasta `targetMs`, actualizada cada segundo. */
export function useCountdown(targetMs: number): TimeLeft {
  const [timeLeft, setTimeLeft] = useState(() => timeLeftUntil(targetMs));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(timeLeftUntil(targetMs)), 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  return timeLeft;
}
