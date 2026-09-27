// Breathing room so the element doesn't end up glued to the list's edge.
const EDGE_MARGIN_PX = 12;

/**
 * Scrolls ONLY the chat list so `el` becomes visible. `scrollIntoView` also
 * scrolls every scrollable ancestor — on mobile that dragged the whole page
 * and the video player along (see useChatScroll, F19).
 *
 * - "center": centers `el` in the list (jumping to a quoted message).
 * - "nearest": scrolls the minimum needed, or nothing if `el` is already
 *   visible (a reaction picker opened under the last message).
 */
export function scrollWithinList(list: HTMLElement, el: HTMLElement, align: "center" | "nearest"): void {
  const listRect = list.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();

  let delta = 0;
  if (align === "center") {
    delta = elRect.top - listRect.top - (list.clientHeight - elRect.height) / 2;
  } else if (elRect.bottom > listRect.bottom) {
    delta = elRect.bottom - listRect.bottom + EDGE_MARGIN_PX;
  } else if (elRect.top < listRect.top) {
    delta = elRect.top - listRect.top - EDGE_MARGIN_PX;
  }
  if (delta === 0) return;

  try {
    list.scrollBy({ top: delta, behavior: "smooth" });
  } catch {
    // Old Safari / jsdom: no scrollBy with options.
    list.scrollTop += delta;
  }
}
