# Nuvio KissAsian Streaming Provider

Fast, client-side streaming scraper for the **Nuvio** app (React Native / Hermes engine), designed to stream Asian dramas, K-dramas, and movies directly from **KissAsian** (`kissasian.cam`).

---

## ⚡ Features

- **Direct Stream Extraction:** Resolves server mirrors (such as Streamtape / Strcloud) into direct, unthrottled `video/mp4` streams.
- **Client-Side & Hermes Ready:**
  - 100% compliant with React Native and Hermes runtime constraints.
  - Zero Node-only built-in modules (`fs`, `child_process`, `crypto`, `http`).
  - Uses standard `fetch()` API with `skipSizeCheck: true`.
  - Transpiled down to ES2016 generator functions via `esbuild` so that dynamic code evaluation inside Hermes does not throw syntax errors.
- **Strict Nuvio Spec Compliance:**
  - Produces standard Nuvio stream objects (`name`, `title`, `url`, `quality`, `headers`).
  - Supports movies and TV series (season and episode matching).
- **Resilient Matching & Fallbacks:**
  - Multi-key TMDB metadata resolver with IMDB ID (`tt...`) and raw title fallbacks.
  - Fuzzy title normalizer that handles noise, release tags, and brackets.
  - Year validation to prevent false positives between sequels and prequels.
- **In-App Settings:**
  - Allows changing the base URL from `https://kissasian.cam` to alternative domain mirrors directly from the Nuvio settings UI.
  - Optional personal TMDB API key input.

---

## 📁 Project Structure

```
nuvio-plugin-kissasian/
├── manifest.json              # Nuvio repository manifest for plugin installation
├── package.json               # Build and test scripts
├── build.js                   # ESBuild bundler targeting ES2016 for Hermes
├── server.js                  # Local HTTP server with CORS for Wi-Fi debugging
├── test.js                    # End-to-end live testing suite
├── src/
│   ├── common/
│   │   ├── tmdb.js            # Resilient TMDB metadata resolver
│   │   └── utils.js           # Title matching, quality parser, fetch helper
│   ├── extractors/
│   │   └── streamtape.js      # Streamtape / Strcloud MP4 stream extractor
│   └── kissasian/
│       ├── api.js             # KissAsian web scraper (search, series, episode mirrors)
│       ├── constants.js       # Base URLs & defaults
│       └── index.js           # KissAsian provider entry point (getStreams & onSettings)
└── providers/
    └── kissasian.js           # Standalone bundled provider for Nuvio
```

---

## 🚀 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Bundle
To compile and bundle files from `src/` into `providers/kissasian.js`:
```bash
npm run build
```

### 3. Run Test Suite
Execute the built provider against live endpoints:
```bash
npm test
```

The test suite verifies:
- Settings schema conformance to Nuvio's provider interface
- TV series episode resolution via TMDB ID (`Queen of Tears S01E01`)
- Raw title query resolution (`Lovely Runner S01E01`)
- Stream reachability with live HTTP HEAD check (verifying HTTP 200 and MP4 content length)

---

## 📱 How to Install in Nuvio App

### Method A: Local Wi-Fi Server (For Fast Development)
1. Start the local server on your PC:
   ```bash
   npm start
   ```
2. Note the LAN URL displayed in the console (e.g. `http://192.168.x.x:3000/manifest.json`).
3. Ensure your phone or Android TV is on the same Wi-Fi network as your PC.
4. Open the **Nuvio** app:
   - Go to **Settings** &rarr; **Scrapers** (or **Add Repository**).
   - Enter your local manifest URL: `http://<YOUR_PC_IP>:3000/manifest.json`.
   - Enable **KissAsian**.

### Method B: Direct GitHub Repository URL
Once pushed to your GitHub repository:
1. In the **Nuvio** app:
   - Go to **Settings** &rarr; **Scrapers** (or **Add Repository**).
   - Enter the raw repository manifest URL:
     ```
     https://raw.githubusercontent.com/iftekhar2002/nuvio-plugin-kissasian/main/manifest.json
     ```
2. Enable **KissAsian**. Done!

### Method C: Direct Plugin File Import
If pasting code directly into Nuvio:
- Provider File: [`providers/kissasian.js`](providers/kissasian.js)

---

## ⚙️ Provider Settings

The provider exports `onSettings()` which generates native configuration fields inside Nuvio:
- **KissAsian Base URL:** If `kissasian.cam` changes its domain or you want to use a proxy, you can set it directly from Nuvio settings.
- **Custom TMDB Key:** Optional field for your personal TMDB API key.
