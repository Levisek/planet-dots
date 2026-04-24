# VISUAL-AUDIT — dots

> Runtime vizuální audit · 2026-04-24 22:43:28 · git `faf2d52` (dirty) · mode `web`

---

## 0. SOUHRN

```
╭─ severity ──────────────────────────────────╮
│  🔴  3 kritik                               │
│  🟡 10 upozornění                           │
│  🟢 13 prošlo                               │
│                                             │
│  zábrana releasu: ANO                       │
╰─────────────────────────────────────────────╯

╭─ pokrytí ───────────────────────────────────╮
│  mode:       web                              │
│  viewporty:  375, 768, 1440                   │
│  windows:    0                                │
│  csp viol:   0                                │
│  console:    4                                │
╰─────────────────────────────────────────────╯
```

---

## 1. 🔴 KRITICKÉ (3)

### V002 · 0× <h1> na stránce (očekáváno 1)

**Viewport:** mobile  
**Fix:** Přidej h1 do hero/main.

---

### V002 · 0× <h1> na stránce (očekáváno 1)

**Viewport:** tablet  
**Fix:** Přidej h1 do hero/main.

---

### V002 · 0× <h1> na stránce (očekáváno 1)

**Viewport:** desktop  
**Fix:** Přidej h1 do hero/main.


---

## 2. 🟡 UPOZORNĚNÍ (10)

### AXE-landmark-one-main · Document should have one main landmark

**Kde:** `html`  
**Viewport:** mobile  
**Detail:**
```
<html lang="cs">
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright

---

### AXE-page-has-heading-one · Page should contain a level-one heading

**Kde:** `html`  
**Viewport:** mobile  
**Detail:**
```
<html lang="cs">
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/page-has-heading-one?application=playwright

---

### AXE-region · All page content should be contained by landmarks

**Kde:** `#canvas`  
**Viewport:** mobile  
**Detail:**
```
<canvas id="canvas" data-engine="three.js r170" width="375" height="812" style="width: 375px; height: 812px; touch-action: none;"></canvas>
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/region?application=playwright

---

### AXE-landmark-one-main · Document should have one main landmark

**Kde:** `html`  
**Viewport:** tablet  
**Detail:**
```
<html lang="cs">
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright

---

### AXE-page-has-heading-one · Page should contain a level-one heading

**Kde:** `html`  
**Viewport:** tablet  
**Detail:**
```
<html lang="cs">
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/page-has-heading-one?application=playwright

---

### AXE-region · All page content should be contained by landmarks

**Kde:** `#canvas`  
**Viewport:** tablet  
**Detail:**
```
<canvas id="canvas" data-engine="three.js r170" width="768" height="1024" style="width: 768px; height: 1024px; touch-action: none;"></canvas
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/region?application=playwright

---

### AXE-landmark-one-main · Document should have one main landmark

**Kde:** `html`  
**Viewport:** desktop  
**Detail:**
```
<html lang="cs">
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/landmark-one-main?application=playwright

---

### AXE-page-has-heading-one · Page should contain a level-one heading

**Kde:** `html`  
**Viewport:** desktop  
**Detail:**
```
<html lang="cs">
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/page-has-heading-one?application=playwright

---

### AXE-region · All page content should be contained by landmarks

**Kde:** `#canvas`  
**Viewport:** desktop  
**Detail:**
```
<canvas id="canvas" data-engine="three.js r170" width="1440" height="900" style="width: 1440px; height: 900px; touch-action: none;"></canvas
```
**Fix:** https://dequeuniversity.com/rules/axe/4.11/region?application=playwright

---

### V084 · 4× console error/warn

**Detail:**
```
[mobile] warning: [.WebGL-0x4ee4001b6c00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
[mobile] warning: [.WebGL-0x4ee4001b6c00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
[mobile] warning: [.WebGL-0x4ee4001b6c00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
[mobile] warning: [.WebGL-0x4ee4001b6c00]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)
```
**Fix:** Odstraň debug log. Reálné errory → error boundary / sentry.




---

## 4. 🟢 PROŠLO (13)

<details><summary>Rozbal seznam</summary>

- `AXE-aria-hidden-body`
- `AXE-avoid-inline-spacing`
- `AXE-document-title`
- `AXE-html-has-lang`
- `AXE-html-lang-valid`
- `AXE-meta-viewport`
- `AXE-meta-viewport-large`
- `AXE-region`
- `V008`
- `V009`
- `V040`
- `V041`
- `V044`

</details>

---

## 5. METADATA

```yaml
timestamp: 2026-04-24T22:43:28.154Z
git_sha: faf2d52
git_branch: master
git_dirty: true
mode: web
target: http://localhost:3000
project_root: C:/dev/planet-dots
playwright: 1.59.1
checklist_version: 0.1.0
```

---

*Generováno `/visual-audit` · Claude Code · screenshoty v `.audit/screenshots/`*
