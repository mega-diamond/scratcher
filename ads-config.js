// Test mode cannot earn revenue. Replace the IDs only after Google approves your account.
window.ScratchAdsConfig = Object.freeze({
  enabled: true,
  testMode: true,
  demoMode: true, // Local, labeled sample ads; no Google scripts or requests.
  roundsPerAd: 3,
  publisherId: "", // Live H5 Games Ads publisher ID: ca-pub-...
  minIntervalMs: 60000,
  loadTimeoutMs: 6000
});
// Live website ads additionally require a Google-certified consent setup.
// Set window.scratchAdsConsentReady to a Promise<boolean> from that setup.
