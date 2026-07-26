import { useLayoutEffect, useRef } from "react";

export function scrollConversationToLatest(scrollContainer) {
  if (!scrollContainer) return;
  scrollContainer.scrollTop = scrollContainer.scrollHeight;
}

export function useConversationBottom(conversationId, latestItemKey) {
  const scrollContainerRef = useRef(null);

  useLayoutEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || !conversationId) return undefined;

    let keepPinnedToLatest = true;
    const scrollToLatest = () => {
      if (keepPinnedToLatest) scrollConversationToLatest(scrollContainer);
    };
    const releasePinnedPosition = () => {
      keepPinnedToLatest = false;
    };
    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scrollToLatest);
    const observeMessageBlocks = () => {
      if (!resizeObserver) return;
      Array.from(scrollContainer.children).forEach((child) => resizeObserver.observe(child));
    };
    const mutationObserver = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(() => {
          observeMessageBlocks();
          scrollToLatest();
        });

    scrollToLatest();
    observeMessageBlocks();
    mutationObserver?.observe(scrollContainer, { childList: true });
    scrollContainer.addEventListener("load", scrollToLatest, true);
    scrollContainer.addEventListener("wheel", releasePinnedPosition, { passive: true });
    scrollContainer.addEventListener("touchstart", releasePinnedPosition, { passive: true });
    scrollContainer.addEventListener("pointerdown", releasePinnedPosition, { passive: true });

    const animationFrame = window.requestAnimationFrame(scrollToLatest);
    const settledLayoutTimer = window.setTimeout(scrollToLatest, 250);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(settledLayoutTimer);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      scrollContainer.removeEventListener("load", scrollToLatest, true);
      scrollContainer.removeEventListener("wheel", releasePinnedPosition);
      scrollContainer.removeEventListener("touchstart", releasePinnedPosition);
      scrollContainer.removeEventListener("pointerdown", releasePinnedPosition);
    };
  }, [conversationId, latestItemKey]);

  return scrollContainerRef;
}
