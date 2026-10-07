(() => {
  const SWIPE_THRESHOLD = 86;

  function createSwipeController({ element, eventTarget, hasCard, onRate, now = Date.now }) {
    let currentDrag = null;
    let ignoreFlipUntil = 0;
    let attached = false;
    const listeners = [];

    function setSwipeVisual(deltaX) {
      const capped = Math.max(-190, Math.min(190, deltaX));
      const rawProgress = Math.min(1, Math.abs(capped) / (currentDrag?.threshold || swipeThreshold()));
      const progress = Math.min(1, rawProgress * 1.35);
      element.style.transform = `translateX(${capped}px) rotate(${capped / 13}deg)`;
      element.style.setProperty("--swipe-left-opacity", capped < 0 ? progress : 0);
      element.style.setProperty("--swipe-right-opacity", capped > 0 ? progress : 0);
      element.style.setProperty("--swipe-left-bg", capped < 0 ? progress : 0);
      element.style.setProperty("--swipe-right-bg", capped > 0 ? progress : 0);
    }

    function resetSwipeVisual() {
      element.classList.remove("is-dragging");
      element.style.transform = "";
      element.style.setProperty("--swipe-left-opacity", 0);
      element.style.setProperty("--swipe-right-opacity", 0);
      element.style.setProperty("--swipe-left-bg", 0);
      element.style.setProperty("--swipe-right-bg", 0);
    }

    function swipeThreshold() {
      const width = element.clientWidth || SWIPE_THRESHOLD * 4;
      return Math.min(SWIPE_THRESHOLD, Math.max(48, width * 0.25));
    }

    function startSwipe(event) {
      if (event.pointerType === "touch") return;
      if (!hasCard() || currentDrag || event.isPrimary === false) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest?.(".listen-button, .translation-chip")) return;
      if (event.pointerType === "mouse") {
        event.preventDefault();
        element.focus({ preventScroll: true });
      }
      currentDrag = { input: "pointer", pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, active: false, threshold: swipeThreshold() };
      element.setPointerCapture?.(event.pointerId);
    }

    function moveSwipe(event) {
      if (currentDrag?.input !== "pointer" || currentDrag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const deltaX = event.clientX - currentDrag.startX;
      const deltaY = event.clientY - currentDrag.startY;
      if (Math.abs(deltaY) >= 8) currentDrag.moved = true;
      if (!currentDrag.active && Math.abs(deltaX) < 8) return;

      currentDrag.active = true;
      element.classList.add("is-dragging");
      setSwipeVisual(deltaX);
    }

    function finishSwipe(event) {
      if (currentDrag?.input !== "pointer" || currentDrag.pointerId !== event.pointerId) return;
      completeSwipe(event.clientX);
    }

    function completeSwipe(clientX) {
      const { startX, active, moved, pointerId, input, threshold } = currentDrag;
      const deltaX = clientX - startX;
      currentDrag = null;
      resetSwipeVisual();
      if (input === "pointer" && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);

      if (active || moved) ignoreFlipUntil = now() + 450;
      if (!active || Math.abs(deltaX) < threshold) return;
      onRate(deltaX > 0);
    }

    function cancelSwipe(event) {
      if (!currentDrag) return;
      // Browsers may cancel pointer events while the separate touch gesture is still alive.
      if (event?.pointerId !== undefined && (currentDrag.input !== "pointer" || event.pointerId !== currentDrag.pointerId)) return;
      const { pointerId, active, moved, input } = currentDrag;
      currentDrag = null;
      if (active || moved) ignoreFlipUntil = now() + 450;
      resetSwipeVisual();
      if (input === "pointer" && element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
    }

    function startTouchSwipe(event) {
      if (event.touches.length !== 1 || currentDrag || !hasCard()) return;
      if (event.target.closest?.(".listen-button, .translation-chip")) return;
      const touch = event.touches[0];
      currentDrag = { input: "touch", touchId: touch.identifier, startX: touch.clientX, startY: touch.clientY, axis: null, active: false, threshold: swipeThreshold() };
    }

    function moveTouchSwipe(event) {
      const drag = currentDrag;
      if (drag?.input !== "touch") return;
      if (event.touches.length !== 1) {
        drag.moved = true;
        cancelSwipe();
        return;
      }
      const touch = [...event.touches].find((item) => item.identifier === drag.touchId);
      if (!touch) return;
      const deltaX = touch.clientX - drag.startX;
      const deltaY = touch.clientY - drag.startY;
      if (!drag.axis) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return;
        drag.moved = true;
        // Decide once: later vertical drift must never hand a horizontal swipe to page scrolling.
        drag.axis = event.cancelable && Math.abs(deltaX) >= Math.abs(deltaY) * 0.8 ? "x" : "y";
      }
      if (drag.axis !== "x") return;
      if (event.cancelable) event.preventDefault();
      drag.active = true;
      element.classList.add("is-dragging");
      setSwipeVisual(deltaX);
    }

    function finishTouchSwipe(event) {
      if (currentDrag?.input !== "touch") return;
      const touch = [...event.changedTouches].find((item) => item.identifier === currentDrag.touchId);
      if (touch) completeSwipe(touch.clientX);
    }
    function listen(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      listeners.push({ target, type, listener, options });
    }

    function attach() {
      if (attached) return;
      attached = true;
      listen(element, "pointerdown", startSwipe);
      listen(element, "pointerup", finishSwipe);
      listen(element, "pointercancel", cancelSwipe);
      listen(element, "lostpointercapture", cancelSwipe);
      listen(eventTarget, "pointerup", finishSwipe);
      listen(eventTarget, "pointercancel", cancelSwipe);
      listen(eventTarget, "pointermove", moveSwipe, { passive: false });
      listen(element, "touchstart", startTouchSwipe, { passive: true });
      listen(eventTarget, "touchstart", (event) => {
        if (event.touches.length > 1 && currentDrag?.input === "touch") {
          currentDrag.moved = true;
          cancelSwipe();
        }
      }, { passive: true });
      listen(element, "touchmove", moveTouchSwipe, { passive: false });
      listen(element, "touchend", finishTouchSwipe, { passive: true });
      listen(element, "touchcancel", () => {
        if (currentDrag?.input === "touch") cancelSwipe();
      }, { passive: true });
      listen(eventTarget, "blur", cancelSwipe);
      listen(element, "dragstart", (event) => event.preventDefault());
    }

    function dispose() {
      for (const { target, type, listener, options } of listeners.splice(0)) target.removeEventListener(type, listener, options);
      attached = false;
      cancelSwipe();
    }

    return {
      attach, dispose, cancel: cancelSwipe,
      canFlip: () => now() >= ignoreFlipUntil,
      get gesture() { return currentDrag ? { ...currentDrag } : null; },
    };
  }
  globalThis.ActionCardsSwipe = Object.freeze({ createSwipeController });
})();
