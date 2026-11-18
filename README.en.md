# Nian Nian Du Gei Ni — Text-to-Speech Mini Program for People with Reading Difficulties

Turn any block of text into one big green button. Built for people who are illiterate,
have low vision, or struggle to read small print.

[简体中文](README.md) | **English**

---

## 1. Quick start (3 steps)

> 📌 **Note**: The WeChat Simultaneous Interpretation plugin (WechatSI) is not available to
> individual (non-corporate) accounts, so this project uses Cloud Functions + Tencent Cloud TTS
> instead. If you later migrate to a corporate account, see the appendix at the end.

### Step 1: Import the project

WeChat DevTools → Import project → select this directory.
Enter your own Mini Program AppID on first import, or copy
`project.config.example.json` to `project.config.json` (the latter holds a real AppID
and is not tracked by Git).

### Three things you must configure yourself

| Config | Where | In repo? | Notes |
| --- | --- | --- | --- |
| Mini Program AppID | `project.config.json` | No — template `project.config.example.json` | Copy the template, fill in your AppID |
| Cloud environment ID | `miniprogram/config/local.js` | No — template `local.example.js` | Leave empty for a single environment |
| Tencent Cloud credentials | Cloud Function env vars | No — never in code | See Step 2 |

```bash
cp project.config.example.json project.config.json
cp miniprogram/config/local.example.js miniprogram/config/local.js
```

The app runs without `local.js`; `config/index.js` silently falls back to defaults.

### Step 2: Enable Cloud Development and deploy Cloud Functions (**required**)

1. Click **Cloud Development** in the top-left of DevTools → activate it
   (available to individual accounts; the free tier is sufficient)
2. Right-click `cloudfunctions/tts`, `cloudfunctions/ocr`, `cloudfunctions/asr`
   → **Upload and deploy: install dependencies in cloud**
   (`asr` powers voice input; the 🎤 button stays hidden without it)
3. Cloud console → **Cloud Functions** → pick a function → **Configuration** →
   **Environment variables**; add both variables to all three functions:

| Variable | Value |
|---|---|
| `SECRET_ID` | Tencent Cloud CAM Secret ID |
| `SECRET_KEY` | Tencent Cloud CAM Secret Key |

> ⚠️ Variable names **must not** start with `SCF_`, `QCLOUD_` or `TENCENTCLOUD_`;
> Cloud Development refuses to save them (error `InvalidParameterValue.Environment`).
> Use exactly the two names above.

Get credentials at [Tencent Cloud Console → API Keys](https://console.cloud.tencent.com/cam/capi).
**Create a sub-account key limited to TTS + OCR + ASR; never use your root account key.**

| Function | Purpose | Required permission |
|---|---|---|
| `tts` | Speech synthesis | `QcloudTTSFullAccess` |
| `ocr` | Text recognition from photos | `QcloudOCRFullAccess` |
| `asr` | Voice input | `QcloudASRFullAccess` (sentence recognition) |

4. Verify: Cloud console → **Cloud Functions** → **Logs**; invoke `tts` once —
   `ok: true` means it works.

### Step 3: Preview

Click **Preview** and scan the QR code on a real device.
**Verify both speech and OCR on an actual phone.**

> Without credentials the app still opens, accepts typing and keeps history;
> tapping "Read to me" just produces no sound (the Settings page reports
> Cloud Development as unavailable).

---

## 2. Cost (refer to Tencent Cloud pricing)

- TTS (basic): free resource pack for new users, then billed per character
- OCR (general printed text, high accuracy): 1,000 calls/month free

---

## 3. Project structure

```
read-aloud/
├── miniprogram/
│   ├── app.js / app.json / app.wxss
│   ├── config/index.js        # speed / font size / voice / split thresholds
│   ├── utils/
│   │   ├── sentence.js        # ★ sentence splitter (core of the project)
│   │   ├── tts.js             # ★ playback queue: synth + sequential play + prefetch
│   │   ├── feedback.js        # ★ spoken feedback for every button
│   │   ├── store.js           # local storage (settings + history + onboarding flag)
│   │   ├── privacy.js         # privacy authorization wrapper
│   │   └── common.js          # human-readable error messages
│   └── pages/
│       ├── index/             # main reading screen (overlay onboarding)
│       ├── crop/              # select a region of a photo before OCR
│       ├── history/           # previously read texts
│       └── settings/          # settings
├── cloudfunctions/
│   ├── tts/                   # text-to-speech (Tencent Cloud TTS)
│   ├── ocr/                   # OCR (Tencent Cloud OCR)
│   └── asr/                   # voice input (sentence recognition, off by default)
└── tests/
    └── sentence.test.js       # splitter regression tests (plain node)
```

---

## 4. Tuning the sentence splitter

Edit `miniprogram/config/index.js`:

```js
softSentenceLen: 45,   // split again at commas beyond this length
maxSentenceLen: 100,   // hard limit (Tencent TTS caps at 110 chars per request)
```

All rules live in `utils/sentence.js`. After any change, **always** run:

```bash
node tests/sentence.test.js
```

29 assertions covering basic splitting, secondary splitting, hard-cut fallback,
no-character-loss detection, number handling, punctuation cleanup, edge cases and
real-world samples (WeChat messages / medicine leaflets).
Exit code 0 = all pass, 1 = failures.

> No-character-loss is a hard requirement: concatenating all segments must equal the
> normalized input. This is the easiest rule to break.

---

## 5. FAQ

**Q: No sound when tapping "Read to me"?**
A: Check in order — ① phone volume > 0 (playback works even in silent mode)
② DevTools console for a "cloud not initialized" warning ③ Settings → Function status,
is Cloud Development red ④ Cloud Function logs for the exact `tts` error.

**Q: DevTools complains "plugin wx069b... not found"?**
A: A plugin declaration was left in `app.json`. The current code has `"plugins": {}`;
make sure it was not added back manually.

**Q: Pasting does nothing?**
A: The privacy guideline is probably not accepted. Mini Program admin → Settings →
Service content declaration → Privacy guideline; check clipboard, album and microphone,
then publish.

**Q: OCR keeps saying it is not enabled?**
A: The `ocr` function is not deployed, or its environment variables are missing.
Cloud Function logs show the reason.

**Q: The 🎤 button is missing?**
A: Cloud Development is not enabled, or `asr` is not deployed. Buttons are rendered
from capability detection and appear after deployment and re-entering the app.

**Q: It keeps reading after switching to a WeChat chat — how do I stop it?**
A: Intentional (background playback continues). Return to the app and tap the big red
button. WeChat also keeps a shortcut back to the Mini Program at the top.

**Q: Reading freezes halfway?**
A: A failed sentence is retried once, then skipped while the rest continues. At the end
a voice prompt reports how many sentences were skipped.

**Q: Can I watch the onboarding again?**
A: Settings → "Replay the walkthrough" at the bottom.

---

## 6. Appendix: plugin route for corporate accounts

If the Mini Program later moves to a corporate account, you can switch back to the
WeChat Simultaneous Interpretation plugin (no credentials, larger free quota):

1. Admin console → Settings → Third-party settings → Plugin management: search and add
   "微信同声传译"
2. In `app.json`, change `"plugins": {}` to:
   ```json
   "plugins": {
     "WechatSI": {
       "version": "<version shown in console>",
       "provider": "<plugin AppID>"
     }
   }
   ```
3. Set `ttsEngine` back to `'plugin'` in `config/index.js`

Capability probing (`probe()` in `utils/tts.js`) supports both channels;
no page changes are needed.

---

## 7. UI constraints

1. Buttons at least 96rpx high; the primary button is a 240rpx circle
2. Body text 60rpx by default, with 46 / 60 / 80rpx options
3. No light-grey text; never below 28rpx
4. Verify every tappable area on a real device — it must exceed a fingertip's reach

> Fuller product design and operations documentation is not included in this repository.

---

## 8. License

[GPL-3.0](LICENSE) © 2026 CVCreate

This program is free software: you can redistribute it and/or modify it under the terms
of the GNU General Public License as published by the Free Software Foundation, either
version 3 of the License, or (at your option) any later version.

Derivative works must be distributed under the same license.
