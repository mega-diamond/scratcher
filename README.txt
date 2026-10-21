ScratchItWithFingernail — MOBILE WEB APP

INSTALL ON A PHONE

1. Extract this folder and upload its contents to an HTTPS static web host.
   Keep index.html, app.js, style.css, sw.js, manifest.webmanifest, and assets/
   together. A normal static host is enough; there is no server application,
   account, build step, or paid dependency.
2. Open the hosted HTTPS address on your phone while online.
3. iPhone: open in Safari, tap Share, then Add to Home Screen. Enable
   Open as Web App if that option appears, then tap Add.
4. Android: open in Chrome. Choose Install app /
   Add to Home screen from Chrome's menu.
5. Open the installed app once online and let the image finish loading.
   Once the offline cache is installed successfully, it works without a connection.

Opening index.html directly from a file manager can preview the game, but
installation and offline caching need a hosted HTTPS address. A localhost
server can be used for development on a computer.

PLAY

- Choose Fingernail for the original fine scratches, or Elephant nail for a
  larger elephant-toenail cursor and scratches three times wider. These choices
  appear in the opening menu and under the Nail button between rounds.
- The selected nail is fixed during a timed round. The result illustration and
  completion message match the nail used.
- An image menu opens at the beginning. Choose an image from your phone or
  use the vintage grayscale dragon background, then tap Continue.
- Images of any supported size are scaled up or down to fit the screen,
  keeping the whole picture visible and preserving its proportions.
- Tap Image between rounds to choose another background. Your selected file
  is used locally for the current session; choose it again after reloading.
- Tap Start to begin a 30-second round. Cutting is disabled before Start and
  after time runs out. Each new round requires pressing Start again.
- Touch the image and swipe to make a cut pointing toward an edge.
  Every swipe cuts, including swipes over an existing cut. There are no
  Cut/Move buttons, and cuts cannot be dragged.
- When time is up, the result shows the percentage of the entire displayed
  image covered by cuts. Empty screen margins are excluded. Overlaps count
  once; parts outside the
  image are clipped. The round clears and the timer resets, as in the original.
- The fingernail is the cursor across the whole app, including Start, Image,
  and dialog buttons. It points opposite to movement. On a phone it appears
  during touch and disappears when you lift your finger. Mouse input also works.
- If the phone locks or switches apps, real time still counts down. An expired
  round finishes when you return. Closing/reloading starts a new session.

FILES

index.html                 App layout
style.css                  Responsive layout and visual styles
app.js                     Cutting, timer, coverage, global cursor, installation
                           Background selection and proportional image fitting
manifest.webmanifest       Home-screen app information
sw.js                      Offline caching
assets/vintage-dragon-background.webp Default vintage grayscale dragon background
assets/fingernail-cursor.png Separate cursor image (not embedded)
assets/icon-*.png           Home-screen icons
assets/apple-touch-icon.png iPhone home-screen icon

UPDATES

After changing files on the host, change the CACHE version in sw.js so a new
offline bundle is installed. Keep versioned script/style URLs in index.html
and sw.js in sync. Changes are picked up on the next app opening.

VERIFICATION

Checked the browser preview and portrait/landscape layout bounds. Automated
logic checks cover the Start gate for mouse/touch/pen, cut-only swipes over
existing cuts, multitouch rejection, opposite cursor rotation over controls
and modal dialogs, touch-end cleanup, the exact time cutoff, round restart,
whole-image coverage result, separate asset paths, manifest entries, and
offline service-worker behavior. Browser checks also verified swipes create
no cuts before Start and do create cuts while the timer is running.
Image-menu checks cover small/large image fitting, coordinates within the
fitted picture, invalid image recovery, file URL cleanup, latest selection
handling, loading controls, and screen rotation. A real browser file-picker
check verified selection and proportional enlargement of a small image.
Physical iPhone/Android installation has not been tested on a device here.

OFFICIAL INSTALLATION REFERENCES

https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios
https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
