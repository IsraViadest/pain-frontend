/**
 * Keeping the page from taking a text selection, in every browser rather than in most of them.
 *
 * `body { user-select: none }` in style.css is the declarative half of this and it is not enough.
 * The property governs what a *user gesture* may start; it does not govern what the browser's own
 * Select All command may do, and browsers disagree about that. Chrome honours it to the point
 * that a range built by hand over `document.body` serialises to the empty string, so Chrome
 * cannot even reproduce the complaint. The operator sees the words highlight on Cmd+A regardless,
 * which means their browser applies Select All over the unselectable subtree and paints it.
 *
 * Rather than guess which engine and chase its version, this removes the selection at the level
 * every engine shares. Three listeners, each covering a route the others miss:
 *
 *   selectstart      a drag that begins on the page
 *   keydown          Cmd+A and Ctrl+A, which is the route the operator named
 *   selectionchange  everything else, including Edit > Select All from the menu bar, which
 *                    fires no key event at all
 *
 * FORM FIELDS OPT OUT, and they opt out on focus rather than on the event target. A selection
 * inside an `<input>` does not reliably report that input as its anchor node, so testing the
 * selection would break the survey's own answer boxes on some engines while looking correct on
 * others. Which element has focus is unambiguous everywhere.
 *
 * This is production chrome, not part of the emotional-pain views, so it is installed
 * unconditionally and not behind the `?ev=1` gate.
 */

/** Anything a person is meant to be able to select inside, and to copy out of. */
const EDITABLE_SELECTOR = "input, textarea, [contenteditable]";

function isInsideEditable(node: EventTarget | Node | null): boolean {
  const element =
    node instanceof Element ? node : node instanceof Node ? node.parentElement : null;
  return element !== null && element.closest(EDITABLE_SELECTOR) !== null;
}

/** Whether the caret currently lives in a field, in which case every rule here stands aside. */
function editableHasFocus(): boolean {
  return isInsideEditable(document.activeElement);
}

export function installTextSelectionGuard(): void {
  document.addEventListener("selectstart", (event) => {
    if (isInsideEditable(event.target)) return;
    event.preventDefault();
  });

  document.addEventListener("keydown", (event) => {
    // Matched on `key` rather than `code`, for the same reason the views panel matches its own
    // shortcuts that way: `code` names a physical key, and the browser's Select All follows the
    // character the layout actually produces.
    if (event.key.toLowerCase() !== "a") return;
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    if (isInsideEditable(event.target)) return;
    event.preventDefault();
  });

  // The catch-all. Collapsing rather than preventing, because by the time this fires the
  // selection exists. Clearing it fires this again with nothing selected, which returns at the
  // line below, so there is no loop.
  document.addEventListener("selectionchange", () => {
    if (editableHasFocus()) return;
    const selection = document.getSelection();
    if (selection === null || selection.isCollapsed) return;
    selection.removeAllRanges();
  });
}
