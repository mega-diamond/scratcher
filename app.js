
    const stage = document.querySelector("#stage");
    const stopwatch = document.querySelector("#stopwatch");
    const timerButton = document.querySelector("#timerButton");
    let touchCursorPointer = null;
    let pendingCreate = null;
    let countdownEndsAt = 0;
    let timerFrame = null;
    let timerRunning = false;
    let backgroundReady = false;
    let backgroundLoading = false;
    let selectedNail = "human";
    let scratchMultiplier = 1;
    const countdownDuration = 30000;

    function randomBetween(min, max) {
      return Math.random() * (max - min) + min;
    }

    function formatTime(milliseconds) {
      const totalTenths = Math.ceil(Math.max(0, milliseconds) / 100);
      const tenths = totalTenths % 10;
      const totalSeconds = Math.floor(totalTenths / 10);
      const seconds = totalSeconds % 60;
      const minutes = Math.floor(totalSeconds / 60);

      return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
    }

    function updateStopwatch() {
      const remaining = timerRunning ? countdownEndsAt - Date.now() : countdownDuration;
      stopwatch.textContent = formatTime(remaining);

      if (timerRunning && remaining <= 0) {
        finishCountdown();
        return;
      }

      if (timerRunning) {
        timerFrame = requestAnimationFrame(updateStopwatch);
      }
    }

    function startCountdown(event) {
      event.stopPropagation();

      if (timerRunning || !backgroundReady || backgroundLoading) {
        return;
      }

      countdownEndsAt = Date.now() + countdownDuration;
      timerRunning = true;
      document.querySelector("#backgroundButton").disabled = true;
      document.querySelector("#nailButton").disabled = true;
      stage.setAttribute("aria-disabled", "false");
      document.querySelector("#toolHint").textContent = "Touch and swipe to cut the image";
      timerButton.textContent = "Running";
      timerButton.disabled = true;
      updateStopwatch();
    }

    function resetCountdown() {
      timerRunning = false;
      document.querySelector("#backgroundButton").disabled = false;
      document.querySelector("#nailButton").disabled = false;
      stage.setAttribute("aria-disabled", "true");
      document.querySelector("#toolHint").textContent = "Press Start to begin";
      cancelAnimationFrame(timerFrame);
      timerButton.textContent = "Start";
      timerButton.disabled = false;
      updateStopwatch();
    }

    function finishCountdown() {
      if (!timerRunning) return;
      // Freeze the interaction, then measure before clearing any shapes/imprints.
      clearPendingCreate(true);
      const blackPercent = calculateBlackShapePercent();
      stage.querySelectorAll(".shape").forEach((shape) => shape.remove());
      resetCountdown();
      document.querySelector("#coverageResult").textContent = blackPercent.toFixed(2) + "%";
      document.querySelector("#resultMessage").textContent = selectedNail === "elephant"
        ? "You scratched it with an elephant's toenail!!!"
        : "You scratched it with your fingernail!!!";
      openAppDialog(document.querySelector("#resultDialog"));
      window.dispatchEvent(new CustomEvent("scratch-round-complete"));
    }

    function calculateBlackShapePercent() {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      // The entire displayed background image is the stage. Use its full area,
      // never the shapes' bounding box or the browser window outside the stage.
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      if (width <= 0 || height <= 0) return 0;

      // Extra resolution reduces edge rounding; alpha weights partial pixels.
      const scale = Math.min(2, Math.max(1, 4096 / Math.max(width, height)));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      context.scale(canvas.width / width, canvas.height / height);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#000";
      // One nonzero-winding fill measures the union, including imprint overlaps.
      // Generated contours all have the same winding direction.
      context.beginPath();

      stage.querySelectorAll(".shape").forEach((shape) => {
        const points = JSON.parse(shape.dataset.points || "[]");
        const renderedStyle = getComputedStyle(shape);
        const length = parseFloat(renderedStyle.width);
        const thickness = parseFloat(renderedStyle.height);
        const x = parseFloat(shape.style.getPropertyValue("--x") || "0");
        const y = parseFloat(shape.style.getPropertyValue("--y") || "0");
        const rotation = parseFloat(shape.style.getPropertyValue("--rotation") || "0") * Math.PI / 180;

        if (points.length === 0 || !Number.isFinite(length) || !Number.isFinite(thickness)
          || length <= 0 || thickness <= 0 || renderedStyle.display === "none") {
          return;
        }

        context.save();
        context.translate(x, y);
        context.rotate(rotation);

        points.forEach((point, index) => {
          const localX = (point.x / 100 - 0.5) * length;
          const localY = (point.y / 100 - 0.5) * thickness;

          if (index === 0) {
            context.moveTo(localX, localY);
          } else {
            context.lineTo(localX, localY);
          }
        });

        context.closePath();
        context.restore();
      });
      context.fill();

      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let blackPixels = 0;

      for (let i = 3; i < pixels.length; i += 4) {
        blackPixels += pixels[i] / 255;
      }

      const wholeImagePixels = canvas.width * canvas.height;
      return Math.min(100, Math.max(0, blackPixels / wholeImagePixels * 100));
    }

    function getNearestEdgePoint(x, y) {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const distances = [
        { edge: "left", value: x },
        { edge: "right", value: width - x },
        { edge: "top", value: y },
        { edge: "bottom", value: height - y }
      ];
      const nearest = distances.reduce((best, current) => (
        current.value < best.value ? current : best
      ));

      if (nearest.edge === "left") {
        return { x: 0, y };
      }

      if (nearest.edge === "right") {
        return { x: width, y };
      }

      if (nearest.edge === "top") {
        return { x, y: 0 };
      }

      return { x, y: height };
    }

    function getEdgePointInMoveDirection(startX, startY, currentX, currentY) {
      const width = stage.clientWidth;
      const height = stage.clientHeight;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      const isDiagonal = absX > 8 && absY > 8 && Math.min(absX, absY) / Math.max(absX, absY) > 0.35;

      if (isDiagonal) {
        return {
          x: deltaX < 0 ? 0 : width,
          y: deltaY < 0 ? 0 : height
        };
      }

      if (absX > absY) {
        return deltaX < 0 ? { x: 0, y: startY } : { x: width, y: startY };
      }

      return deltaY < 0 ? { x: startX, y: 0 } : { x: startX, y: height };
    }

    function generateMountainClipPath() {
      // Correlated variation makes flowing contours instead of random spikes.
      // Both sides advance along x, so even deep notches cannot cross.
      const phase = Array.from({ length: 8 }, () => randomBetween(0, Math.PI * 2));
      const bend = randomBetween(-9, 9);
      const taper = randomBetween(0.8, 1.7);
      const shoulder = randomBetween(0.08, 0.34);
      const upper = [];
      const lower = [];
      const notches = Array.from({ length: 3 }, () => ({
        position: randomBetween(0.12, 0.88),
        width: randomBetween(0.018, 0.065),
        depth: randomBetween(0.08, 0.32),
        side: Math.random() < 0.5 ? 0 : 1
      }));
      const samples = 100;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const center = 50 + bend * Math.sin(Math.PI * t)
          + 4 * Math.sin(2 * Math.PI * t + phase[0]) * Math.sin(Math.PI * t);
        const envelope = 37 * Math.pow(1 - t, taper)
          * (0.78 + 0.3 * Math.exp(-Math.pow((t - shoulder) / 0.23, 2)));
        const edges = [0, 1].map((side) => {
          const offset = side * 3;
          let variation = 1 + 0.13 * Math.sin(t * 9 + phase[1 + offset])
            + 0.065 * Math.sin(t * 27 + phase[2 + offset])
            + 0.065 * Math.sin(t * 83 + phase[3 + offset]);
          for (const notch of notches) {
            if (notch.side === side) {
              variation -= notch.depth * Math.exp(-Math.pow((t - notch.position) / notch.width, 2));
            }
          }
          return envelope * Math.max(0.35, variation);
        });
        upper.push({ x: t * 100, y: center - edges[0] });
        lower.push({ x: t * 100, y: center + edges[1] });
      }
      const contour = upper.concat(lower.slice(0, -1).reverse());
      const minY = Math.min(...contour.map(point => point.y));
      const maxY = Math.max(...contour.map(point => point.y));
      // Store exactly the same coordinates used by CSS for canvas coverage.
      const points = contour.map(point => ({
        x: Number(point.x.toFixed(4)),
        y: Number(((point.y - minY) / (maxY - minY) * 100).toFixed(4))
      }));
      const polygon = points.map(point => `${point.x}% ${point.y}%`).join(", ");

      return {
        css: `polygon(${polygon})`,
        points
      };
    }

    function addCutSurface(shape, points) {
      const namespace = "http://www.w3.org/2000/svg";
      const surface = document.createElementNS(namespace, "svg");
      surface.classList.add("cut-surface");
      surface.setAttribute("viewBox", "0 0 100 100");
      surface.setAttribute("preserveAspectRatio", "none");
      surface.setAttribute("aria-hidden", "true");
      // A fine lit lip on one side and a dim rim on the other suggest
      // a torn image surface with a dark opening beneath it.
      const tipIndex = points.findIndex(point => point.x === 100);
      const edges = [points.slice(0, tipIndex + 1), points.slice(tipIndex)];
      edges.forEach((edge, index) => {
        const rim = document.createElementNS(namespace, "polyline");
        rim.setAttribute("points", edge.map(point => `${point.x},${point.y}`).join(" "));
        rim.setAttribute("fill", "none");
        rim.setAttribute("stroke", index === 0 ? "rgba(245,239,222,0.72)" : "rgba(145,137,123,0.35)");
        rim.setAttribute("stroke-width", index === 0 ? "1.6" : "0.9");
        rim.setAttribute("vector-effect", "non-scaling-stroke");
        rim.setAttribute("stroke-linejoin", "round");
        surface.appendChild(rim);
      });
      shape.appendChild(surface);
    }

    function generateRandomShape(x, y, edgePoint = getNearestEdgePoint(x, y)) {
      const shape = document.createElement("div");
      const centerX = (x + edgePoint.x) / 2;
      const centerY = (y + edgePoint.y) / 2;
      const deltaX = x - edgePoint.x;
      const deltaY = y - edgePoint.y;
      const length = Math.hypot(deltaX, deltaY);
      const thickness = Math.max(1.5, Math.min(28, length * randomBetween(0.025, 0.075))) * scratchMultiplier;
      const rotation = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

      shape.className = "shape";
      shape.style.setProperty("--length", `${length}px`);
      shape.style.setProperty("--thickness", `${thickness}px`);
      shape.style.setProperty("--x", `${centerX}px`);
      shape.style.setProperty("--y", `${centerY}px`);
      shape.style.setProperty("--rotation", `${rotation}deg`);
      shape.style.backgroundColor = "#000";
      const mountain = generateMountainClipPath();
      shape.style.clipPath = mountain.css;
      shape.style.borderRadius = "0";
      shape.dataset.points = JSON.stringify(mountain.points);
      shape.dataset.length = length;
      shape.dataset.thickness = thickness;
      addCutSurface(shape, mountain.points);

      stage.appendChild(shape);
      return shape;
    }

    function startCreate(event) {
      if (event.isPrimary === false || event.button !== 0 || pendingCreate) return;
      if (!timerRunning || !backgroundReady || backgroundLoading) return;
      if (Date.now() >= countdownEndsAt) {
        finishCountdown();
        return;
      }
      event.preventDefault();

      pendingCreate = {
        pointerId: event.pointerId,
        startX: event.clientX - stage.getBoundingClientRect().left,
        startY: event.clientY - stage.getBoundingClientRect().top,
        startClientX: event.clientX,
        startClientY: event.clientY
      };

      stage.setPointerCapture(event.pointerId);
      stage.addEventListener("pointermove", createOnMove);
      stage.addEventListener("pointerup", stopCreate);
      stage.addEventListener("pointercancel", stopCreate);
    }

    function createOnMove(event) {
      if (!timerRunning) {
        clearPendingCreate(true);
        return;
      }
      if (Date.now() >= countdownEndsAt) {
        finishCountdown();
        return;
      }
      if (!pendingCreate || event.pointerId !== pendingCreate.pointerId) {
        return;
      }

      const moved = Math.hypot(
        event.clientX - pendingCreate.startClientX,
        event.clientY - pendingCreate.startClientY
      );

      if (moved <= 3) {
        return;
      }

      const edgePoint = getEdgePointInMoveDirection(
        pendingCreate.startX,
        pendingCreate.startY,
        event.clientX - stage.getBoundingClientRect().left,
        event.clientY - stage.getBoundingClientRect().top
      );
      generateRandomShape(pendingCreate.startX, pendingCreate.startY, edgePoint);
      clearPendingCreate(true);
    }

    function stopCreate(event) {
      if (!pendingCreate || event.pointerId !== pendingCreate.pointerId) {
        return;
      }

      clearPendingCreate(true);
    }

    function clearPendingCreate(releaseCapture) {
      if (!pendingCreate) {
        return;
      }

      const { pointerId } = pendingCreate;
      stage.removeEventListener("pointermove", createOnMove);
      stage.removeEventListener("pointerup", stopCreate);
      stage.removeEventListener("pointercancel", stopCreate);

      if (releaseCapture && stage.hasPointerCapture(pointerId)) {
        stage.releasePointerCapture(pointerId);
      }

      pendingCreate = null;
    }

    stage.addEventListener("pointerdown", startCreate);
    timerButton.addEventListener("pointerdown", (event) => event.stopPropagation());
    timerButton.addEventListener("click", startCountdown);
    // The photo points upward. Rotate about its nail tip, which stays exactly
    // at the pointer coordinates during cutting, dragging, and direction changes.
    const nailCursor = document.querySelector("#nailCursor");
    let nailTipX = Number(nailCursor.dataset.tipX);
    let nailTipY = Number(nailCursor.dataset.tipY);
    let previousCursorPoint = null;
    let nailAngle = 0;
    let cursorHeading = { x: 0, y: -1 };

    function hideNailCursor() {
      touchCursorPointer = null;
      nailCursor.hidden = true;
      previousCursorPoint = null;
    }

    function enableNailCursor() {
      if (nailCursor.naturalWidth > 0) document.documentElement.classList.add("cursor-ready");
    }

    function moveNailCursor(event) {
      if (event.isPrimary === false) return;
      if (event.pointerType === "touch" && event.pointerId !== touchCursorPointer) return;
      if (!document.documentElement.classList.contains("cursor-ready")) {
        hideNailCursor();
        return;
      }

      if (previousCursorPoint) {
        const dx = event.clientX - previousCursorPoint.x;
        const dy = event.clientY - previousCursorPoint.y;
        // Ignore tiny hand tremors; keep the last heading while stationary.
        const distance = Math.hypot(dx, dy);
        if (distance >= 1.5) {
          cursorHeading = { x: dx / distance, y: dy / distance };
          const direction = Math.atan2(dy, dx) * 180 / Math.PI + 270;
          const turn = ((direction - nailAngle) % 360 + 540) % 360 - 180;
          nailAngle += turn;
          previousCursorPoint = { x: event.clientX, y: event.clientY };
        }
      } else {
        previousCursorPoint = { x: event.clientX, y: event.clientY };
      }

      syncNailCursorLayer();
      nailCursor.hidden = false;
      // Lead the mouse by 10 CSS pixels; touch stays aligned to the fingertip.
      const lead = event.pointerType === "touch" ? 0 : 10;
      nailCursor.style.transform = `translate3d(${event.clientX + cursorHeading.x * lead - nailTipX}px, ${event.clientY + cursorHeading.y * lead - nailTipY}px, 0) rotate(${nailAngle}deg)`;
    }

    nailCursor.addEventListener("load", enableNailCursor);
    nailCursor.addEventListener("error", () => {
      document.documentElement.classList.remove("cursor-ready");
      hideNailCursor();
    });
    if (nailCursor.complete) enableNailCursor();
    window.addEventListener("pointermove", moveNailCursor, { passive: true });
    window.addEventListener("pointerout", event => {
      if (event.relatedTarget === null) hideNailCursor();
    });
    window.addEventListener("pointercancel", hideNailCursor);
    window.addEventListener("blur", hideNailCursor);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) hideNailCursor();
    });

  
    function stopInteraction() {
      clearPendingCreate(true);
      hideNailCursor();
    }

    document.addEventListener("pointerdown", event => {
      if (event.isPrimary === false || event.button !== 0) return;
      if (event.pointerType === "touch") touchCursorPointer = event.pointerId;
      previousCursorPoint = null;
      moveNailCursor(event);
    }, { capture: true, passive: true });
    window.addEventListener("pointerup", event => {
      if (event.pointerType === "touch" && event.pointerId === touchCursorPointer) hideNailCursor();
    });
    window.addEventListener("blur", stopInteraction);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopInteraction();
      // A phone may suspend animation frames. Real time still counts down.
      else if (timerRunning) {
        cancelAnimationFrame(timerFrame);
        updateStopwatch();
      }
    });
    window.addEventListener("pageshow", () => {
      if (timerRunning) {
        cancelAnimationFrame(timerFrame);
        updateStopwatch();
      }
    });
    function syncNailCursorLayer() {
      // Native dialogs occupy the top layer; keep the cursor in the active
      // dialog so it remains visible above buttons and modal backdrops.
      const dialog = nailCursor.closest("dialog[open]") || document.querySelector("dialog[open]");
      const host = dialog || document.body;
      if (nailCursor.parentElement !== host) host.appendChild(nailCursor);
    }

    function openAppDialog(dialog) {
      dialog.showModal();
      dialog.appendChild(nailCursor);
    }

    for (const dialog of document.querySelectorAll("dialog")) {
      dialog.addEventListener("close", syncNailCursorLayer);
    }
    document.querySelector("#resultDialog").addEventListener("close", () => timerButton.focus({ preventScroll: true }));

    if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {
          const status = document.querySelector("#appStatus");
          status.textContent = "Offline mode is unavailable. You can still use the app online.";
          status.hidden = false;
          setTimeout(() => { status.hidden = true; }, 6000);
        });
      });
    }

    const backgroundDialog = document.querySelector("#backgroundDialog");
    const backgroundInput = document.querySelector("#backgroundInput");
    const backgroundContinue = document.querySelector("#backgroundContinue");
    const backgroundError = document.querySelector("#backgroundError");
    let backgroundImage = null;
    let ownedBackgroundURL = null;
    let backgroundLoadNumber = 0;

    function fitBackgroundToScreen() {
      if (!backgroundImage) return;
      stopInteraction();
      const oldWidth = stage.clientWidth;
      const factor = Math.min(window.innerWidth / backgroundImage.naturalWidth,
        window.innerHeight / backgroundImage.naturalHeight);
      const width = Math.max(1, Math.round(backgroundImage.naturalWidth * factor));
      const height = Math.max(1, Math.round(backgroundImage.naturalHeight * factor));
      // Existing cuts keep the same position and proportions on image resize.
      const scale = oldWidth > 0 ? width / oldWidth : 1;
      for (const shape of stage.querySelectorAll(".shape")) {
        for (const property of ["--x", "--y", "--length", "--thickness"]) {
          shape.style.setProperty(property, `${parseFloat(shape.style.getPropertyValue(property)) * scale}px`);
        }
        shape.dataset.length = parseFloat(shape.style.getPropertyValue("--length"));
        shape.dataset.thickness = parseFloat(shape.style.getPropertyValue("--thickness"));
      }
      stage.style.width = `${width}px`;
      stage.style.height = `${height}px`;
    }

    function updateBackgroundControls() {
      backgroundContinue.disabled = backgroundLoading || !backgroundReady;
      timerButton.disabled = timerRunning || backgroundLoading || !backgroundReady;
    }

    function loadBackground(source, name, ownsURL = false) {
      const loadNumber = ++backgroundLoadNumber;
      backgroundLoading = true;
      backgroundError.hidden = true;
      updateBackgroundControls();
      const image = new Image();
      return new Promise(resolve => {
        image.onload = () => {
          if (loadNumber !== backgroundLoadNumber) {
            if (ownsURL) URL.revokeObjectURL(source);
            resolve(false);
            return;
          }
          const previousURL = ownedBackgroundURL;
          backgroundImage = image;
          ownedBackgroundURL = ownsURL ? source : null;
          stage.querySelectorAll(".shape").forEach(shape => shape.remove());
          stage.style.backgroundImage = `url("${source}")`;
          document.querySelector("#backgroundPreview").src = source;
          document.querySelector("#backgroundName").textContent = name;
          backgroundReady = true;
          backgroundLoading = false;
          fitBackgroundToScreen();
          updateBackgroundControls();
          if (previousURL) URL.revokeObjectURL(previousURL);
          resolve(true);
        };
        image.onerror = () => {
          if (ownsURL) URL.revokeObjectURL(source);
          if (loadNumber === backgroundLoadNumber) {
            backgroundLoading = false;
            backgroundError.textContent = "This image could not be opened. Try a JPG, PNG, WebP, or another supported image.";
            backgroundError.hidden = false;
            updateBackgroundControls();
          }
          resolve(false);
        };
        image.src = source;
      });
    }

    document.querySelector("#chooseImageButton").addEventListener("click", () => backgroundInput.click());
    backgroundInput.addEventListener("change", () => {
      const file = backgroundInput.files && backgroundInput.files[0];
      if (file) loadBackground(URL.createObjectURL(file), file.name, true);
      // Choosing the same file again should also trigger a change.
      backgroundInput.value = "";
    });
    document.querySelector("#originalImageButton").addEventListener("click", () => {
      loadBackground("./assets/couple-background.jpg", "Photo");
    });
    document.querySelector("#backgroundButton").addEventListener("click", () => {
      if (!timerRunning) openAppDialog(backgroundDialog);
    });
    backgroundDialog.addEventListener("cancel", event => {
      if (backgroundLoading || !backgroundReady) event.preventDefault();
    });
    backgroundDialog.addEventListener("close", () => timerButton.focus({ preventScroll: true }));
    window.addEventListener("resize", fitBackgroundToScreen);
    loadBackground("./assets/couple-background.jpg", "Photo");
    openAppDialog(backgroundDialog);

    const nailProfiles = {
      human: { src: "./assets/fingernail-cursor.png", width: 30, height: 100, tipX: 15, tipY: 0, multiplier: 1 },
      elephant: {"src":"./assets/elephant-nail.png","width":72,"height":96,"tipX":35.75,"tipY":0,"multiplier":3}
    };

    function selectNail(kind) {
      if (timerRunning || !Object.hasOwn(nailProfiles, kind)) return;
      const profile = nailProfiles[kind];
      clearPendingCreate(true);
      hideNailCursor();
      selectedNail = kind;
      scratchMultiplier = profile.multiplier;
      nailTipX = profile.tipX;
      nailTipY = profile.tipY;
      nailCursor.style.width = profile.width + "px";
      nailCursor.style.height = profile.height + "px";
      nailCursor.style.transformOrigin = profile.tipX + "px " + profile.tipY + "px";
      nailCursor.dataset.tipX = profile.tipX;
      nailCursor.dataset.tipY = profile.tipY;
      if (nailCursor.getAttribute("src") !== profile.src || nailCursor.naturalWidth === 0) {
        document.documentElement.classList.remove("cursor-ready");
        nailCursor.src = profile.src;
      }
      document.querySelector("#resultNail").src = profile.src;
      document.querySelector("#resultArt").dataset.nail = kind;
      document.querySelector("#nailButton").textContent = kind === "elephant" ? "Nail: Elephant" : "Nail: Fingernail";
      for (const button of document.querySelectorAll("[data-nail].nail-option")) {
        button.setAttribute("aria-pressed", String(button.dataset.nail === kind));
      }
    }

    for (const button of document.querySelectorAll("[data-nail].nail-option")) {
      button.addEventListener("click", () => selectNail(button.dataset.nail));
    }
    document.querySelector("#nailButton").addEventListener("click", () => {
      if (!timerRunning) openAppDialog(document.querySelector("#nailDialog"));
    });
    selectNail("human");
