# Archived: Dialog Unfocus / Shrink Behavior

> Restored from commit `ca683a2` / `52653ae`. To re-enable, reverse the changes below.

## CSS (`style.css`, ~lines 316-379)

```css
/* ===== Dialog Unfocus/Shrink Animation (archived) ===== */

/* Single keyframe pair — restore is exact reverse via direction */
@keyframes shrink-to-corner {
  100% { top: auto; left: auto; bottom: 20px; right: 20px; transform: none; max-width: 220px; width: auto; padding: 10px; opacity: 0.45; }
}

@keyframes shrink-backdrop {
  100% { background: transparent; }
}

.dialog.unfocused .dialog-content {
  animation: shrink-to-corner 0.3s ease forwards;
  pointer-events: auto;
  cursor: pointer;
}

.dialog.unfocused .dialog-backdrop {
  animation: shrink-backdrop 0.3s ease forwards;
}

.dialog.restoring .dialog-content {
  animation: shrink-to-corner 0.3s ease reverse forwards;
  pointer-events: auto;
}

.dialog.restoring .dialog-backdrop {
  animation: shrink-backdrop 0.3s ease reverse forwards;
}

.dialog.unfocused .dialog-content:hover {
  opacity: 0.75 !important;
}

/* Disable all children EXCEPT close button */
.dialog.unfocused .dialog-content *:not(.dialog-close) {
  pointer-events: none;
}

/* Let clicks pass through to main app when shrunk */
.dialog.unfocused {
  pointer-events: none;
}

/* But keep the shrunk card itself clickable */
.dialog.unfocused .dialog-content {
  pointer-events: auto;
}
```

## JS (`main.js`, ~lines 387-427)

```javascript
// Backdrop click → shrink (do NOT close)
exportDialog.querySelector('.dialog-backdrop').addEventListener('click', () => {
  exportDialog.classList.add('unfocused');
});

// Click shrunk dialog → restore with animation
const dialogContent = exportDialog.querySelector('.dialog-content');
dialogContent.addEventListener('click', (e) => {
  if (exportDialog.classList.contains('unfocused')) {
    exportDialog.classList.remove('unfocused');
    exportDialog.classList.add('restoring');
    e.stopPropagation();
    setTimeout(() => exportDialog.classList.remove('restoring'), 400);
  }
});

// Any interaction outside dialog → shrink
viewerContainer.addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) {
    exportDialog.classList.add('unfocused');
  }
});

// Toolbar interactions also trigger shrink
document.getElementById('toolbar').addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) {
    exportDialog.classList.add('unfocused');
  }
});
```

## Mode-aware variant (if only some modes should shrink)

Replace the above JS with mode-branching:

```javascript
exportDialog.querySelector('.dialog-backdrop').addEventListener('click', () => {
  if (dialogMode === 'cubemap') {
    hideExportDialog();
  } else {
    exportDialog.classList.add('unfocused');
  }
});

viewerContainer.addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) {
    if (dialogMode === 'cubemap') hideExportDialog();
    else exportDialog.classList.add('unfocused');
  }
});
```
