(function () {
  "use strict";

  const CONFIG = {
    frameChain: __FRAME_CHAIN__,
  };

  if (window.__selectorFinderActive) return;
  window.__selectorFinderActive = true;

  // --- Utility: extract element info ---
  function getElementInfo(el) {
    const attrs = {};
    for (const attr of el.attributes) attrs[attr.name] = attr.value;
    const path = [];
    let cur = el;
    for (let i = 0; i < 4 && cur && cur !== document.body; i++) {
      const tag = cur.tagName.toLowerCase();
      const id = cur.id ? '#' + cur.id : '';
      const cls = cur.classList.length ? '.' + [...cur.classList].join('.') : '';
      path.unshift(tag + id + cls);
      cur = cur.parentElement;
    }
    const frameChain = CONFIG.frameChain || [];
    return {
      tagName: el.tagName.toLowerCase(),
      id: el.id || null,
      role: el.getAttribute('role') || null,
      ariaLabel: el.getAttribute('aria-label') || null,
      classList: [...el.classList],
      attributes: attrs,
      textContent: (el.textContent || '').trim().slice(0, 100),
      parentPath: path.join(' > '),
      outerHTML: el.outerHTML.slice(0, 500),
      frameChain: frameChain.length > 0 ? frameChain : null,
    };
  }

  // --- Iframe relay: highlight + relay clicks to top frame ---
  let isTopFrame;
  try {
    isTopFrame = window === window.top;
  } catch {
    isTopFrame = false;
  }
  if (!isTopFrame) {
    let pickerActive = true;

    const iframeOverlay = document.createElement('div');
    iframeOverlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #0969da;border-radius:3px;background:rgba(9,105,218,0.1);z-index:2147483647;transition:all 0.05s ease;display:none;';
    document.body.appendChild(iframeOverlay);

    document.addEventListener('mouseover', (e) => {
      if (!pickerActive) return;
      const rect = e.target.getBoundingClientRect();
      iframeOverlay.style.display = 'block';
      iframeOverlay.style.top = rect.top + 'px';
      iframeOverlay.style.left = rect.left + 'px';
      iframeOverlay.style.width = rect.width + 'px';
      iframeOverlay.style.height = rect.height + 'px';
    }, true);

    document.addEventListener('mouseout', () => {
      if (!pickerActive) return;
      iframeOverlay.style.display = 'none';
    }, true);

    document.addEventListener('click', (e) => {
      if (!pickerActive) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const info = getElementInfo(e.target);
      try {
        window.top.postMessage({
          type: '__selector-finder-iframe-click',
          info,
        }, '*');
      } catch {}
    }, true);

    window.addEventListener('message', (e) => {
      if (e.data?.type === '__selector-finder-deactivate') {
        pickerActive = false;
        iframeOverlay.style.display = 'none';
      } else if (e.data?.type === '__selector-finder-activate') {
        pickerActive = true;
      } else if (e.data?.type === '__selector-finder-cleanup') {
        pickerActive = false;
        iframeOverlay.remove();
        window.__selectorFinderActive = false;
      }
    });

    return; // Don't create float ball/panel in iframes
  }

  // --- Shadow DOM Host ---
  const host = document.createElement('div');
  host.id = '__selector-finder-host';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  // --- Hide/show entire UI ---
  function hideAllUI() {
    if (host.parentNode) host.parentNode.removeChild(host);
    broadcastToAllFrames({ type: '__selector-finder-cleanup' });
  }
  function showAllUI() {
    if (!host.parentNode) document.body.appendChild(host);
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
  }

  // --- Styles (pick-mode only) ---
  const style = document.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    .sf-ball {
      position: fixed; bottom: 24px; right: 24px; z-index: 2;
      width: 48px; height: 48px; border-radius: 50%;
      background: #0969da; color: #fff; border: none;
      cursor: grab; display: flex; align-items: center; justify-content: center;
      font-size: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: transform 0.15s, background 0.15s;
      user-select: none;
    }
    .sf-ball:hover { transform: scale(1.1); }
    .sf-ball.active { background: #1a7f37; }
    .sf-drag-shield {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      z-index: 1; display: none; cursor: grabbing;
    }
    .sf-panel {
      position: fixed;
      width: 380px; max-height: 480px; overflow-y: auto;
      background: #fff; border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      font: 13px/1.5 -apple-system, 'Segoe UI', sans-serif;
      color: #24292f; display: none; padding: 0;
    }
    .sf-panel.open { display: block; }
    .sf-panel-header {
      padding: 12px 16px; border-bottom: 1px solid #d0d7de;
      font-weight: 600; font-size: 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .sf-panel-body { padding: 12px 16px; }
    .sf-element-info {
      background: #f6f8fa; border-radius: 6px; padding: 8px 12px;
      font-family: 'Fira Code', monospace; font-size: 12px;
      margin-bottom: 12px; word-break: break-all;
    }
    .sf-btn {
      padding: 4px 10px; border-radius: 6px; border: 1px solid #d0d7de;
      background: #fff; color: #24292f; cursor: pointer; font-size: 12px;
      margin-left: 4px; white-space: nowrap;
    }
    .sf-btn:hover { background: #f3f4f6; }
    .sf-btn.confirm { background: #1a7f37; color: #fff; border-color: #1a7f37; }
    .sf-btn.confirm:hover { background: #157a2f; }
    .sf-overlay {
      position: fixed; pointer-events: none;
      border: 2px solid #0969da; border-radius: 3px;
      background: rgba(9,105,218,0.1);
      z-index: 2147483646; transition: all 0.05s ease; display: none;
    }
    .sf-inspect-btn {
      width: 28px; height: 28px; border-radius: 6px; border: 1px solid #d0d7de;
      background: #fff; cursor: pointer; display: flex; align-items: center;
      justify-content: center; font-size: 16px; padding: 0;
      transition: background 0.15s, border-color 0.15s;
    }
    .sf-inspect-btn:hover { background: #f3f4f6; }
    .sf-inspect-btn.active {
      background: #0969da; border-color: #0969da; color: #fff;
    }
    .sf-status {
      padding: 8px 16px; font-size: 12px; color: #656d76;
      text-align: center; border-top: 1px solid #d0d7de;
    }
  `;
  shadow.appendChild(style);

  // --- Overlay (highlight on hover) ---
  const overlay = document.createElement('div');
  overlay.className = 'sf-overlay';
  shadow.appendChild(overlay);

  // --- Drag Shield ---
  const dragShield = document.createElement('div');
  dragShield.className = 'sf-drag-shield';
  shadow.appendChild(dragShield);

  // --- Float Ball ---
  const ball = document.createElement('button');
  ball.className = 'sf-ball';
  ball.textContent = '\uD83C\uDFAF';
  ball.title = 'Element Picker';
  shadow.appendChild(ball);

  // --- Panel ---
  const panel = document.createElement('div');
  panel.className = 'sf-panel';
  panel.innerHTML = `
    <div class="sf-panel-header">
      <span>Element Picker</span>
      <button class="sf-inspect-btn" id="inspect-toggle" title="Select an element on the page">\uD83D\uDD0D</button>
    </div>
    <div class="sf-panel-body">
      <div class="sf-element-info" style="display:none"></div>
      <div class="sf-selectors"></div>
    </div>
    <div class="sf-status">Picker mode: inactive</div>
  `;
  shadow.appendChild(panel);

  const elementInfo = panel.querySelector('.sf-element-info');
  const selectorsContainer = panel.querySelector('.sf-selectors');
  const statusBar = panel.querySelector('.sf-status');
  const inspectBtn = shadow.getElementById('inspect-toggle');

  inspectBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePicker(!pickerActive);
  });

  // --- State ---
  let pickerActive = false;
  let panelOpen = false;
  let pendingElementInfo = null;

  // --- Position panel relative to ball ---
  function positionPanel() {
    if (!panelOpen) return;
    const br = ball.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const ph = pr.height || 200;
    const pw = 380;

    let top = (br.top - gap - ph > 0) ? br.top - gap - ph : br.bottom + gap;
    let left = br.left + br.width / 2 - pw / 2;
    left = Math.max(gap, Math.min(left, vw - pw - gap));
    top = Math.max(gap, Math.min(top, vh - ph - gap));

    panel.style.top = top + 'px';
    panel.style.left = left + 'px';
    panel.style.bottom = 'auto';
    panel.style.right = 'auto';
  }

  // --- Clamp ball to viewport on resize ---
  function clampBall() {
    if (!ball.style.left) { positionPanel(); return; }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = parseInt(ball.style.left, 10);
    let top = parseInt(ball.style.top, 10);
    left = Math.max(0, Math.min(left, vw - 48));
    top = Math.max(0, Math.min(top, vh - 48));
    ball.style.left = left + 'px';
    ball.style.top = top + 'px';
    positionPanel();
  }
  window.addEventListener('resize', clampBall);

  // --- Auto-activate picker (pick-only, no mode check) ---
  panelOpen = true;
  panel.classList.add('open');
  togglePicker(true);
  requestAnimationFrame(positionPanel);

  // --- Top frame listens for iframe relay ---
  window.addEventListener('message', (e) => {
    if (e.data?.type === '__selector-finder-iframe-click') {
      pendingElementInfo = e.data.info;
      showPickConfirm(e.data.info);
      if (!panelOpen) {
        panelOpen = true;
        panel.classList.add('open');
      }
      togglePicker(false);
      positionPanel();
    }
  });

  // --- Pick confirm UI (writes result to window.__pickerResult) ---
  function showPickConfirm(info) {
    elementInfo.style.display = 'block';
    elementInfo.textContent = `<${info.tagName}${info.id ? ' id="'+info.id+'"' : ''}${info.classList.length ? ' class="'+info.classList.join(' ')+'"' : ''}>`;
    statusBar.textContent = info.tagName + (info.id ? '#'+info.id : '');

    selectorsContainer.innerHTML = '';

    const details = document.createElement('div');
    details.style.cssText = 'font-size:12px;color:#656d76;margin-bottom:8px;';
    const lines = [];
    if (info.id) lines.push('ID: ' + info.id);
    if (info.classList.length) lines.push('Class: ' + info.classList.join(' '));
    if (info.role) lines.push('Role: ' + info.role);
    if (info.ariaLabel) lines.push('Label: ' + info.ariaLabel);
    if (info.textContent) lines.push('Text: ' + info.textContent.slice(0, 60));
    details.textContent = lines.join(' \u00B7 ') || 'No identifying attributes';
    selectorsContainer.appendChild(details);

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'sf-btn confirm';
    confirmBtn.style.cssText = 'flex:1;padding:8px;font-size:13px;';
    confirmBtn.textContent = 'Confirm';

    const repickBtn = document.createElement('button');
    repickBtn.className = 'sf-btn';
    repickBtn.style.cssText = 'flex:1;padding:8px;font-size:13px;';
    repickBtn.textContent = 'Re-pick';

    confirmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__pickerResult = info;
      hideAllUI();
    });

    repickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePicker(true);
    });

    btnRow.appendChild(repickBtn);
    btnRow.appendChild(confirmBtn);
    selectorsContainer.appendChild(btnRow);
  }

  // --- Float Ball: Toggle panel ---
  let didDrag = false;
  ball.addEventListener('click', (e) => {
    e.stopPropagation();
    if (didDrag) { didDrag = false; return; }
    panelOpen = !panelOpen;
    panel.classList.toggle('open', panelOpen);
    positionPanel();
  });

  // --- Float Ball: Drag ---
  let dragging = false, dragX, dragY, ballX, ballY;
  ball.addEventListener('mousedown', (e) => {
    dragging = true;
    didDrag = false;
    dragX = e.clientX;
    dragY = e.clientY;
    const rect = ball.getBoundingClientRect();
    ballX = rect.left;
    ballY = rect.top;
    ball.style.cursor = 'grabbing';
    dragShield.style.display = 'block';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    didDrag = true;
    const dx = e.clientX - dragX;
    const dy = e.clientY - dragY;
    const newLeft = Math.max(0, Math.min(ballX + dx, window.innerWidth - 48));
    const newTop = Math.max(0, Math.min(ballY + dy, window.innerHeight - 48));
    ball.style.position = 'fixed';
    ball.style.left = newLeft + 'px';
    ball.style.top = newTop + 'px';
    ball.style.right = 'auto';
    ball.style.bottom = 'auto';
    positionPanel();
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    ball.style.cursor = 'grab';
    positionPanel();
    setTimeout(() => {
      dragShield.style.display = 'none';
      didDrag = false;
    }, 100);
  });

  // --- Broadcast to all child frames ---
  function broadcastToAllFrames(msg) {
    function send(win) {
      for (let i = 0; i < win.frames.length; i++) {
        try {
          win.frames[i].postMessage(msg, '*');
          send(win.frames[i]);
        } catch {}
      }
    }
    send(window);
  }

  // --- Picker Mode ---
  function togglePicker(on) {
    pickerActive = on;
    ball.classList.toggle('active', on);
    inspectBtn.classList.toggle('active', on);
    statusBar.textContent = on ? 'Picker mode: active \u2014 click an element' : 'Picker mode: inactive';
    if (!on) {
      overlay.style.display = 'none';
      overlay.style.borderColor = '#0969da';
      overlay.style.background = 'rgba(9,105,218,0.1)';
    }
    broadcastToAllFrames({
      type: on ? '__selector-finder-activate' : '__selector-finder-deactivate',
    });
  }

  // --- Element Picker Events ---
  document.addEventListener('mouseover', (e) => {
    if (!pickerActive || didDrag || e.target === host) return;
    const rect = e.target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  }, true);

  document.addEventListener('mouseout', () => {
    if (pickerActive) overlay.style.display = 'none';
  }, true);

  document.addEventListener('click', (e) => {
    if (didDrag) { didDrag = false; return; }
    if (!pickerActive || e.target === host) return;
    if (e.target.closest?.('#__selector-finder-host')) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const info = getElementInfo(e.target);
    pendingElementInfo = info;

    showPickConfirm(info);
    if (!panelOpen) {
      panelOpen = true;
      panel.classList.add('open');
    }
    togglePicker(false);
    positionPanel();
  }, true);

})();
