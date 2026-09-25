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
export function useCountdown(targetMs: number): TimeLeft & { isPast: boolean } {
  const [timeLeft, setTimeLeft] = useState(() => timeLeftUntil(targetMs));

  useEffect(() => {
    const timer = setInterval(() => setTimeLeft(timeLeftUntil(targetMs)), 1000);
    return () => clearInterval(timer);
  }, [targetMs]);

  // Llegó la hora: todo en cero. F35: antes el contador quedaba clavado en
  // 00:00:00 sin decir nada mientras se esperaba la señal.
  const isPast = targetMs > 0 && timeLeft.hours === 0 && timeLeft.minutes === 0 && timeLeft.seconds === 0;
  return { ...timeLeft, isPast };
}
