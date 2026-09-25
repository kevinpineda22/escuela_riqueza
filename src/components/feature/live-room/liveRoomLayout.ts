/**
 * Composición de la sala según el espacio disponible (F12):
 *  - `stacked`: celular vertical. Video arriba, chat debajo.
 *  - `side`: pantalla amplia. Video y chat lado a lado, chat abierto.
 *  - `compact`: horizontal con poca altura (≤500 px). Prioridad al video;
 *    el chat arranca cerrado y se abre como panel.
 *
 * La altura manda sobre el ancho: un 844×390 superaba los 768 px y heredaba el
 * layout de escritorio (chat fijo de 320 px, header de 32 px de padding sobre
 * el video), y un 667×375 caía en el apilado con ~100 px de chat.
 */
export type LiveRoomLayout = "stacked" | "side" | "compact";

export function getLiveRoomLayout(isDesktop: boolean, isShortLandscape: boolean): LiveRoomLayout {
  if (isShortLandscape) return "compact";
  return isDesktop ? "side" : "stacked";
}
