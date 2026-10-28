import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLivePlayback } from "./useLivePlayback";

describe("useLivePlayback — fase 3: sonido y Solo audio", () => {
  it("la clase arranca CON sonido y sin aviso", () => {
    const { result } = renderHook(() => useLivePlayback());
    const [, playback] = result.current;
    expect(playback.isMuted).toBe(false);
    expect(playback.awaitingGesture).toBe(false);
  });

  it("si el navegador bloquea el sonido: silencio, aviso y espera del primer toque", () => {
    const { result } = renderHook(() => useLivePlayback());

    act(() => { result.current[1].playerEvents.onAutoplayBlocked(); });

    const [, playback] = result.current;
    expect(playback.isMuted).toBe(true);
    expect(playback.audioPromptDismissed).toBe(false);
    expect(playback.awaitingGesture).toBe(true);
  });

  it("tras un bloqueo en una recarga, el aviso vuelve aunque se hubiera cerrado", () => {
    const { result } = renderHook(() => useLivePlayback());
    act(() => { result.current[1].dismissAudioPrompt(); });

    act(() => { result.current[1].playerEvents.onAutoplayBlocked(); });

    expect(result.current[1].audioPromptDismissed).toBe(false);
  });

  it("seguir sin sonido deja de esperar el toque", () => {
    const { result } = renderHook(() => useLivePlayback());
    act(() => { result.current[1].playerEvents.onAutoplayBlocked(); });

    act(() => { result.current[1].dismissAudioPrompt(); });

    expect(result.current[1].awaitingGesture).toBe(false);
  });

  it("Solo audio cambia el elemento (mediaKey) y vuelve", () => {
    const { result } = renderHook(() => useLivePlayback());
    const videoKey = result.current[1].mediaKey;

    act(() => { result.current[1].toggleAudioOnly(); });
    expect(result.current[1].audioOnly).toBe(true);
    expect(result.current[1].mediaKey).not.toBe(videoKey);

    act(() => { result.current[1].toggleAudioOnly(); });
    expect(result.current[1].audioOnly).toBe(false);
    expect(result.current[1].mediaKey).toBe(videoKey);
  });

  it("Reintentar en Solo audio da un elemento nuevo sin salir de Solo audio", () => {
    const { result } = renderHook(() => useLivePlayback());
    act(() => { result.current[1].toggleAudioOnly(); });
    const before = result.current[1].mediaKey;

    act(() => { result.current[1].retryPlayer(); });

    expect(result.current[1].audioOnly).toBe(true);
    expect(result.current[1].mediaKey).not.toBe(before);
  });
});
