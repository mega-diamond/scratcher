(() => {
  "use strict";
  const preview = document.querySelector("#backgroundPreview");
  const name = document.querySelector("#backgroundName");
  const input = document.querySelector("#backgroundInput");
  const saveDefault = document.querySelector("#setDefaultImageButton");
  const status = document.querySelector("#defaultImageStatus");
  let savedImage = null;
  let selectionChanged = false;
  let saving = false;

  function updateCaption() {
    if (name.textContent.trim() === "Couple photo") name.textContent = "Photo";
  }
  function updateSaveButton() {
    const loading = typeof backgroundLoading !== "undefined" && backgroundLoading;
    saveDefault.disabled = saving || loading || !preview.complete || preview.naturalWidth === 0;
  }
  function announce(message) { status.textContent = message; }

  function database() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("scratchit-image-preferences", 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("settings")) request.result.createObjectStore("settings");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async function readDefault() {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", "readonly");
        const request = transaction.objectStore("settings").get("default-image");
        let value = null;
        request.onsuccess = () => { value = request.result || null; };
        transaction.oncomplete = () => resolve(value);
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }
  async function writeDefault(blob) {
    const db = await database();
    try {
      await new Promise((resolve, reject) => {
        const transaction = db.transaction("settings", "readwrite");
        transaction.objectStore("settings").put(blob, "default-image");
        transaction.oncomplete = resolve;
        transaction.onabort = () => reject(transaction.error);
        transaction.onerror = () => reject(transaction.error);
      });
    } finally { db.close(); }
  }
  function showSavedImage() {
    return savedImage
      ? loadBackground(URL.createObjectURL(savedImage), "Photo", true)
      : loadBackground("./assets/couple-background.jpg", "Photo");
  }

  updateCaption();
  updateSaveButton();
  new MutationObserver(updateCaption).observe(name, { childList: true, subtree: true });
  new MutationObserver(updateSaveButton).observe(preview, { attributes: true, attributeFilter: ["src"] });
  preview.addEventListener("load", updateSaveButton);
  preview.addEventListener("error", updateSaveButton);
  input.addEventListener("change", () => { selectionChanged = true; announce(""); }, true);

  const initialized = readDefault().then(async blob => {
    savedImage = blob;
    if (savedImage && !selectionChanged) {
      if (!await showSavedImage()) announce("The saved image could not be opened. Choose another image to replace it.");
    }
  }).catch(() => {
    announce("Saved image settings are unavailable in this browser.");
  }).finally(updateSaveButton);

  saveDefault.addEventListener("click", async () => {
    if (saveDefault.disabled) return;
    saving = true;
    updateSaveButton();
    try {
      await initialized;
      const response = await fetch(preview.currentSrc || preview.src);
      if (!response.ok) throw new Error("Image unavailable");
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty image");
      await writeDefault(blob);
      savedImage = blob;
      announce("Default image saved on this device.");
    } catch {
      announce("The image could not be saved. Try again or check this browser’s storage settings.");
    } finally {
      saving = false;
      updateSaveButton();
    }
  });
})();
