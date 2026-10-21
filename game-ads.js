(() => {
  "use strict";
  const config = window.ScratchAdsConfig || {};
  const nativeAds = window.ScratchAds;
  const dialogs = [document.querySelector("#backgroundDialog"), document.querySelector("#resultDialog")];
  const start = document.querySelector("#timerButton");
  const controls = [...document.querySelectorAll("#stage, .toolbar, .bottom-controls")];
  let pending = false;
  let lastShown = -Infinity;
  let finishNative = null;
  let roundsSincePlacement = 0;
  window.addEventListener("scratch-round-complete", () => { roundsSincePlacement++; });

  const banner = document.querySelector("#demoMenuBanner");
  if (banner) banner.hidden = !(config.enabled && config.demoMode);

  const demoAd = document.createElement("dialog");
  demoAd.id = "demoAdDialog";
  demoAd.setAttribute("aria-labelledby", "demoAdTitle");
  demoAd.innerHTML = '<div class="demo-ad-top"><span>Demo advertisement</span><button type="button" class="demo-ad-close" aria-label="Close demo ad">✕</button></div>' +
    '<div class="demo-ad-content"><span class="demo-ad-badge">SAMPLE AD</span><h1 id="demoAdTitle">A little break.<br>More scratching ahead.</h1>' +
    '<p>A full-screen ad would appear here between rounds.</p><p class="demo-ad-note">Demo only · No live advertising</p></div>';
  document.body.appendChild(demoAd);
  demoAd.querySelector("button").addEventListener("click", () => demoAd.close());
  demoAd.addEventListener("close", () => syncNailCursorLayer());

  const curtain = document.createElement("div");
  curtain.id = "adTransition";
  curtain.hidden = true;
  curtain.setAttribute("role", "status");
  curtain.setAttribute("aria-live", "polite");
  curtain.textContent = "Opening game…";
  document.body.appendChild(curtain);

  const privacy = document.createElement("button");
  privacy.type = "button";
  privacy.className = "image-button";
  privacy.textContent = "Ad privacy";
  privacy.hidden = true;
  document.querySelector(".tool-row").appendChild(privacy);
  window.addEventListener("scratch-ad-privacy", event => { privacy.hidden = !event.detail; });
  privacy.addEventListener("click", () => { if (!pending && nativeAds) nativeAds.postMessage("privacy"); });

  if (nativeAds) {
    nativeAds.onmessage = event => {
      if (event.data === "showing") curtain.hidden = true;
      else if (finishNative) { const finish = finishNative; finishNative = null; finish(event.data === "shown"); }
    };
  }

  async function prepareWebsiteAds() {
    // Android uses the native SDK exclusively, including on older WebViews without the bridge.
    if (config.demoMode || nativeAds || location.hostname === "appassets.androidplatform.net" || !config.enabled) return false;
    if (!config.testMode) {
      if (!/^ca-pub-\d{16}$/.test(config.publisherId || "")) return false;
      if (!window.scratchAdsConsentReady || !await window.scratchAdsConsentReady) return false;
    }
    return new Promise(resolve => {
      let settled = false;
      const complete = value => { if (!settled) { settled = true; clearTimeout(timeout); resolve(value); } };
      const timeout = setTimeout(() => complete(false), config.loadTimeoutMs || 6000);
      window.adsbygoogle = window.adsbygoogle || [];
      window.adBreak = window.adConfig = options => window.adsbygoogle.push(options);
      window.adConfig({preloadAdBreaks: "on", sound: "off", onReady: () => complete(true)});
      const script = document.createElement("script");
      script.async = true;
      script.crossOrigin = "anonymous";
      // This placeholder is the publisher ID in Google's official test-mode example.
      script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" +
        encodeURIComponent(config.publisherId || "ca-pub-123456789");
      if (config.testMode) script.setAttribute("data-adbreak-test", "on");
      script.onerror = () => complete(false);
      document.head.appendChild(script);
    });
  }
  const webReady = Promise.race([
    prepareWebsiteAds().catch(() => false),
    new Promise(resolve => setTimeout(() => resolve(false), config.loadTimeoutMs || 6000))
  ]);

  async function requestAd() {
    if (config.enabled && config.demoMode) {
      return new Promise(resolve => {
        demoAd.addEventListener("close", () => resolve(true), {once: true});
        curtain.hidden = true;
        openAppDialog(demoAd);
      });
    }
    if (!config.enabled || Date.now() - lastShown < (config.minIntervalMs || 60000)) return false;
    if (nativeAds) {
      return new Promise(resolve => {
        finishNative = resolve;
        try { nativeAds.postMessage("show"); }
        catch { finishNative = null; resolve(false); }
      });
    }
    if (!await webReady) return false;
    return new Promise(resolve => {
      let shown = false;
      window.adBreak({
        type: "next", name: "after_three_rounds",
        beforeAd: () => { shown = true; curtain.hidden = true; },
        afterAd: () => {},
        adBreakDone: () => resolve(shown)
      });
    });
  }

  async function continueToGame(event, dialog) {
    event.preventDefault();
    if (pending || !dialog.open || (dialog.id === "backgroundDialog" && document.querySelector("#backgroundContinue").disabled)) return;
    const due = dialog.id === "resultDialog" && roundsSincePlacement >= (config.roundsPerAd || 3);
    if (!due) {
      dialog.close();
      updateBackgroundControls();
      start.focus({preventScroll: true});
      return;
    }
    roundsSincePlacement = 0;
    pending = true;
    const previousInert = controls.map(control => control.inert);
    start.disabled = true;
    controls.forEach(control => { control.inert = true; });
    curtain.hidden = false;
    dialog.close();
    try { if (await requestAd()) lastShown = Date.now(); }
    catch (error) { console.warn("Ad unavailable; opening game.", error); }
    finally {
      curtain.hidden = true;
      controls.forEach((control, index) => { control.inert = previousInert[index]; });
      pending = false;
      updateBackgroundControls();
      start.focus({preventScroll: true});
    }
  }
  dialogs.forEach(dialog => {
    dialog.querySelector("form").addEventListener("submit", event => { void continueToGame(event, dialog); });
  });
  document.querySelector("#resultDialog").addEventListener("cancel", event => { void continueToGame(event, document.querySelector("#resultDialog")); });
})();
