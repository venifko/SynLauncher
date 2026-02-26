const { ipcRenderer, remote } = require('electron');
const { downloadClientTorrent } = require('./functions');
const { PATCH_NOTES_URL } = require('./constants');

// Simple modal dialog for confirmations
function showModal(message) {
  return new Promise((resolve) => {
    // Modal overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(24,26,32,0.7)';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    // Modal box
    const modal = document.createElement('div');
    modal.style.background = '#23272e';
    modal.style.color = '#eee';
    modal.style.padding = '32px 28px';
    modal.style.borderRadius = '10px';
    modal.style.boxShadow = '0 8px 32px 0 rgba(0,0,0,0.28)';
    modal.style.textAlign = 'center';
    modal.style.maxWidth = '90vw';
    modal.style.fontSize = '1.2rem';
    modal.innerHTML = `<div style='margin-bottom: 18px;'>${message}</div>`;

    // Buttons
    const okBtn = document.createElement('button');
    okBtn.textContent = 'Update Now';
    okBtn.style.margin = '0 12px';
    okBtn.style.padding = '8px 28px';
    okBtn.style.background = '#17406d';
    okBtn.style.color = '#fff';
    okBtn.style.border = 'none';
    okBtn.style.fontSize = '1.1rem';
    okBtn.style.borderRadius = '4px';
    okBtn.style.cursor = 'pointer';
    okBtn.onmouseover = () => okBtn.style.background = '#0d2238';
    okBtn.onmouseleave = () => okBtn.style.background = '#17406d';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.margin = '0 12px';
    cancelBtn.style.padding = '8px 28px';
    cancelBtn.style.background = '#444';
    cancelBtn.style.color = '#fff';
    cancelBtn.style.border = 'none';
    cancelBtn.style.fontSize = '1.1rem';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.onmouseover = () => cancelBtn.style.background = '#222';
    cancelBtn.onmouseleave = () => cancelBtn.style.background = '#444';

    okBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(true);
    };
    cancelBtn.onclick = () => {
      document.body.removeChild(overlay);
      resolve(false);
    };

    modal.appendChild(okBtn);
    modal.appendChild(cancelBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  // Check for launcher updates
  try {
    const updateInfo = await ipcRenderer.invoke('check-for-launcher-update');
    if (updateInfo && updateInfo.updateAvailable) {
      let msg = `A new version of the Synastria Launcher is available!\n\n`;
      msg += `Latest version: v${updateInfo.latestVersion}\n`;
      msg += `Release: ${updateInfo.releaseName || ''}\n\n`;
      if (updateInfo.body) {
        msg += `${updateInfo.body.substring(0, 350)}\n\n`;
      }
      msg += `Would you like to download it now?`;
      const confirmed = await (typeof showModal === 'function'
        ? showModal(msg)
        : Promise.resolve(window.confirm(msg)));
      if (confirmed) {
        try {
          await ipcRenderer.invoke('download-launcher-update', updateInfo.downloadUrl);
          alert('Installer is downloading. The launcher will close when the installer starts.');
        } catch (err) {
          alert('Failed to start download: ' + (err && err.message ? err.message : err));
        }
      }
    }
  } catch (err) {
    // Optionally log or ignore update check errors
  }
  // Make body draggable except for controls
  document.body.style['-webkit-app-region'] = 'drag';

  // Add custom exit button (top right)
  const exitBtn = document.createElement('button');
  exitBtn.textContent = '✕';
  exitBtn.title = 'Close';
  exitBtn.style.position = 'fixed';
  exitBtn.style.top = '18px';
  exitBtn.style.right = '22px';
  exitBtn.style.width = '38px';
  exitBtn.style.height = '38px';
  exitBtn.style.fontSize = '1.5rem';
  exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.style.color = '#fff';
  exitBtn.style.border = 'none';
  exitBtn.style.borderRadius = '8px';
  exitBtn.style.cursor = 'pointer';
  exitBtn.style.zIndex = '10000';
  exitBtn.style['-webkit-app-region'] = 'no-drag';
  exitBtn.onmouseover = () => exitBtn.style.background = '#a62828';
  exitBtn.onmouseleave = () => exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.onclick = () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('close-window');
  };

  document.body.appendChild(exitBtn);

  const { extractPatchVersion } = require('./functions');
  const { getPatchDownloadLink } = require('./patch_scraper');

  // Helper: Checks for patch update and installs if needed
  async function checkAndUpdatePatch(config) {
    showStatus('Checking for updates...');
    try {
      const latestPatchUrl = await getPatchDownloadLink();
      if (!latestPatchUrl) {
        showStatus('Could not check for patch updates.');
        return false;
      }
      const latestVersion = extractPatchVersion(latestPatchUrl);
      if (!latestVersion) {
        showStatus('Could not determine latest patch version.');
        return false;
      }
      if (!config || config.patchVersion !== latestVersion) {
        const confirmed = await showModal('A new version of the patch is available!\n\nWould you like to update now?');
        if (!confirmed) {
          showStatus('Update cancelled. You may not be able to play until updated.');
          return false;
        }
        showStatus('Downloading latest patch...');
        const result = await ipcRenderer.invoke('download-and-install-patch', config && config.clientDir ? config.clientDir : '');
        showStatus(result.message);
        // Reload config after update
        return true;
      }
      showStatus('Launcher is up to date.');
      return false;
    } catch (err) {
      showStatus('Error checking for updates: ' + err.message);
      return false;
    }
  }


// Show only a Play button after patch is installed
function showPlayButton(clientDir) {
  // Clear all launcher content
  document.body.innerHTML = '';

  // Add custom exit button (top right)
  let exitBtn = document.getElementById('custom-exit-btn');
  if (exitBtn) exitBtn.remove();
  exitBtn = document.createElement('button');
  exitBtn.id = 'custom-exit-btn';
  exitBtn.textContent = '✕';
  exitBtn.title = 'Close';
  exitBtn.style.position = 'fixed';
  exitBtn.style.top = '18px';
  exitBtn.style.right = '22px';
  exitBtn.style.width = '38px';
  exitBtn.style.height = '38px';
  exitBtn.style.fontSize = '1.5rem';
  exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.style.color = '#fff';
  exitBtn.style.border = 'none';
  exitBtn.style.borderRadius = '8px';
  exitBtn.style.cursor = 'pointer';
  exitBtn.style.zIndex = '10000';
  exitBtn.style['-webkit-app-region'] = 'no-drag';
  exitBtn.onmouseover = () => exitBtn.style.background = '#a62828';
  exitBtn.onmouseleave = () => exitBtn.style.background = 'rgba(30,36,48,0.82)';
  exitBtn.onclick = () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.invoke('close-window');
  };

  document.body.appendChild(exitBtn);

  // Set up flex column layout for body
  document.body.style.display = 'flex';
  document.body.style.flexDirection = 'column';
  document.body.style.alignItems = 'center';
  document.body.style.justifyContent = 'center';
  document.body.style.height = '100vh';
  document.body.style.margin = '0';
  document.body.style.background = "#181a20 url('background.png') center center / cover no-repeat fixed";
  document.body.style.position = 'relative';

  // Overlay for darkening the background for readability
  let overlay = document.getElementById('bg-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'bg-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(24,26,32,0.6)'; // lighter overlay
    overlay.style.zIndex = '0';
    overlay.style.pointerEvents = 'none';
    document.body.insertBefore(overlay, document.body.firstChild);
  }

  // Inject modern scrollbar CSS for patch notes
  const style = document.createElement('style');
  style.textContent = `
    .patch-notes::-webkit-scrollbar {
      width: 10px;
    }
    .patch-notes::-webkit-scrollbar-thumb {
      background: #2e3540;
      border-radius: 8px;
      border: 2px solid #23272e;
    }
    .patch-notes::-webkit-scrollbar-track {
      background: #23272e;
      border-radius: 8px;
    }
    .patch-notes {
      scrollbar-width: thin;
      scrollbar-color: #2e3540 #23272e;
    }
  `;
  document.head.appendChild(style);

  // Patch notes area
  const patchNotes = document.createElement('div');
  patchNotes.style.width = '90%';
  patchNotes.style.maxWidth = '600px';
  patchNotes.style.height = '60%';
  patchNotes.style.maxHeight = '320px';
  patchNotes.style.margin = '0 auto 32px auto';
  patchNotes.style.background = '#23272e';
  patchNotes.style.color = '#eee';
  patchNotes.style.border = '2px solid #444';
  patchNotes.style.borderRadius = '0';
  patchNotes.style.padding = '24px';
  patchNotes.style.overflowY = 'auto';
  patchNotes.style.fontSize = '1.1rem';
  patchNotes.style.boxSizing = 'border-box';
  patchNotes.className = 'patch-notes';
  patchNotes.style.zIndex = '1';
  patchNotes.style['-webkit-app-region'] = 'no-drag';
  // patchNotes.innerHTML = PATCH_NOTES_HTML;
  // Dynamically fetch patch notes from remote URL
  fetch(PATCH_NOTES_URL)
    .then(response => response.text())
    .then(html => {
      patchNotes.innerHTML = html;
    })
    .catch(err => {
      patchNotes.innerHTML = ('<b>Failed to load patch notes.</b>' + err);
      console.error('Failed to fetch patch notes:', err);
    });
  document.body.appendChild(patchNotes);

  // Play button
  const playBtn = document.createElement('button');
  playBtn.textContent = 'Launch Synastria';
  playBtn.style.fontSize = '1.5rem';
  playBtn.style.width = '320px';
  playBtn.style.height = '64px';
  playBtn.style.whiteSpace = 'nowrap';
  playBtn.style.overflow = 'hidden';
  playBtn.style.textOverflow = 'ellipsis';
  playBtn.style.background = '#17406d';
  playBtn.style.margin = '0 auto';
  playBtn.style.display = 'block';
  playBtn.style.background = '#1e90ff';
  playBtn.style.color = '#fff';
  playBtn.style.border = 'none';
  playBtn.style.borderRadius = '0';
  playBtn.style.boxShadow = '0 4px 16px rgba(0,0,0,0.20)';
  playBtn.style.cursor = 'pointer';
  playBtn.style.fontWeight = 'bold';
  playBtn.style.letterSpacing = '0.1em';
  playBtn.style.transition = 'background 0.2s';
  playBtn.style.zIndex = '1';
  playBtn.style['-webkit-app-region'] = 'no-drag';
  playBtn.onmouseover = () => playBtn.style.background = '#0d2238';
  playBtn.onmouseleave = () => playBtn.style.background = '#17406d';
  playBtn.onclick = () => {
    ipcRenderer.invoke('launch-wowext', clientDir);
  };
  document.body.appendChild(playBtn);

  // Addons button
  const addonsBtn = document.createElement('button');
  addonsBtn.textContent = 'Manage Addons';
  addonsBtn.style.fontSize = '1rem';
  addonsBtn.style.width = '180px';
  addonsBtn.style.height = '38px';
  addonsBtn.style.marginTop = '16px';
  addonsBtn.style.background = '#283046';
  addonsBtn.style.color = '#fff';
  addonsBtn.style.border = 'none';
  addonsBtn.style.borderRadius = '5px';
  addonsBtn.style.cursor = 'pointer';
  addonsBtn.style.boxShadow = '0 2px 8px rgba(80,80,80,0.08)';
  addonsBtn.style['-webkit-app-region'] = 'no-drag';
  addonsBtn.onmouseover = () => addonsBtn.style.background = '#1a1d21';
  addonsBtn.onmouseleave = () => addonsBtn.style.background = '#283046';

  let addonsPanel = null;
  addonsBtn.onclick = async () => {
    // Remove any existing panel
    if (addonsPanel) addonsPanel.remove();

    // Inject styles once
    if (!document.getElementById('synastria-addons-css')) {
      const css = document.createElement('style');
      css.id = 'synastria-addons-css';
      css.textContent = `
        .sa-panel { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(24,28,38,0.98); z-index:20001; display:flex; flex-direction:column; font-family:Segoe UI,Arial,sans-serif; }
        .sa-header { display:flex; align-items:center; justify-content:space-between; padding:14px 20px 10px 20px; flex-shrink:0; }
        .sa-header h2 { margin:0; font-size:1.15rem; color:#fff; font-weight:600; letter-spacing:0.3px; }
        .sa-status { padding:0 20px 8px 20px; flex-shrink:0; }
        .sa-status-bar { height:3px; background:#1a1d24; border-radius:2px; overflow:hidden; }
        .sa-status-fill { height:100%; width:0%; background:#1e90ff; border-radius:2px; transition:width 0.3s; }
        .sa-status-text { font-size:0.75rem; color:#8899aa; margin-top:3px; min-height:14px; }
        .sa-table-head { display:flex; padding:0 20px; flex-shrink:0; border-bottom:1px solid #2a2f3a; }
        .sa-table-head > div { padding:6px 6px; font-size:0.7rem; color:#667; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
        .sa-list { flex:1; overflow-y:auto; padding:0 12px 12px 12px; }
        .sa-list::-webkit-scrollbar { width:8px; }
        .sa-list::-webkit-scrollbar-thumb { background:#2e3540; border-radius:4px; }
        .sa-list::-webkit-scrollbar-thumb:hover { background:#4e5a7a; }
        .sa-list::-webkit-scrollbar-track { background:transparent; }
        .sa-row { display:flex; align-items:center; padding:5px 8px; border-radius:4px; margin:1px 0; cursor:default; -webkit-app-region:no-drag; }
        .sa-row:hover { background:rgba(50,56,75,0.6) !important; }
        .sa-row .sa-name { flex:0 0 170px; font-weight:600; font-size:0.82rem; color:#e8ecf2; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:8px; }
        .sa-row .sa-desc { flex:1; font-size:0.75rem; color:#8899aa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:8px; }
        .sa-row .sa-author { flex:0 0 75px; font-size:0.75rem; color:#6ab0e4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:8px; }
        .sa-row .sa-date { flex:0 0 85px; font-size:0.72rem; text-align:right; padding-right:8px; white-space:nowrap; }
        .sa-row .sa-date.installed { color:#4eca6a; }
        .sa-row .sa-date.not-installed { color:#556; }
        .sa-row .sa-actions { flex:0 0 80px; text-align:right; }
        .sa-btn { border:none; border-radius:3px; padding:3px 12px; font-size:0.75rem; font-weight:600; cursor:pointer; transition:background 0.15s, opacity 0.15s; -webkit-app-region:no-drag; }
        .sa-btn:disabled { opacity:0.5; cursor:wait; }
        .sa-btn-install { background:#17406d; color:#fff; }
        .sa-btn-install:hover:not(:disabled) { background:#1e5a9a; }
        .sa-btn-uninstall { background:#6b2020; color:#ddd; }
        .sa-btn-uninstall:hover:not(:disabled) { background:#8b2a2a; }
        .sa-btn-close { background:#2a2f3a; color:#ccc; border:none; border-radius:3px; padding:5px 28px; font-size:0.85rem; cursor:pointer; -webkit-app-region:no-drag; }
        .sa-btn-close:hover { background:#3a4050; }
        .sa-footer { display:flex; justify-content:center; padding:10px 20px 14px 20px; flex-shrink:0; border-top:1px solid #2a2f3a; }
        .sa-count { font-size:0.7rem; color:#556; margin-left:8px; }
      `;
      document.head.appendChild(css);
    }

    addonsPanel = document.createElement('div');
    addonsPanel.className = 'sa-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'sa-header';
    const title = document.createElement('h2');
    title.textContent = 'Manage Addons';
    header.appendChild(title);
    const countLabel = document.createElement('span');
    countLabel.className = 'sa-count';
    header.appendChild(countLabel);
    addonsPanel.appendChild(header);

    // AI warning
    const aiWarn = document.createElement('div');
    aiWarn.textContent = '[AI] Warning: Addons tagged with [AI] have a higher likelihood of memory leaks!';
    aiWarn.style.cssText = 'padding:4px 20px 8px;font-size:0.72rem;color:#e8a33a;flex-shrink:0;';
    addonsPanel.appendChild(aiWarn);

    // Status/progress area
    const statusArea = document.createElement('div');
    statusArea.className = 'sa-status';
    const statusBar = document.createElement('div');
    statusBar.className = 'sa-status-bar';
    const statusFill = document.createElement('div');
    statusFill.className = 'sa-status-fill';
    statusBar.appendChild(statusFill);
    statusArea.appendChild(statusBar);
    const statusText = document.createElement('div');
    statusText.className = 'sa-status-text';
    statusArea.appendChild(statusText);
    addonsPanel.appendChild(statusArea);

    function setProgress(pct, msg) {
      statusFill.style.width = pct + '%';
      statusText.textContent = msg || '';
    }

    // Column headers
    const colHead = document.createElement('div');
    colHead.className = 'sa-table-head';
    [['170px','Name'],['1','Description'],['75px','Author'],['85px','Updated'],['80px','']].forEach(([w,label]) => {
      const col = document.createElement('div');
      col.textContent = label;
      col.style.flex = w.includes('px') ? '0 0 '+w : w;
      colHead.appendChild(col);
    });
    addonsPanel.appendChild(colHead);

    // Scrollable addon list
    const list = document.createElement('div');
    list.className = 'sa-list';
    addonsPanel.appendChild(list);

    // Footer with close button
    const footer = document.createElement('div');
    footer.className = 'sa-footer';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'sa-btn-close';
    closeBtn.textContent = 'Close';
    closeBtn.onclick = () => { addonsPanel.remove(); addonsPanel = null; };
    footer.appendChild(closeBtn);
    addonsPanel.appendChild(footer);

    document.body.appendChild(addonsPanel);

    // Fetch list
    setProgress(0, 'Loading addon list...');
    const res = await ipcRenderer.invoke('get-addons-list');
    if (!res.success) {
      setProgress(0, 'Failed to load addons: ' + res.message);
      return;
    }
    // Sort: installed first, then alphabetically within each group
    const addons = res.addons.sort((a, b) => {
      if (a.installed && !b.installed) return -1;
      if (!a.installed && b.installed) return 1;
      return a.name.localeCompare(b.name);
    });
    const installedCount = addons.filter(a => a.installed).length;
    countLabel.textContent = installedCount + ' / ' + addons.length + ' installed';
    setProgress(100, addons.length + ' addons loaded');
    setTimeout(() => { statusFill.style.width = '0%'; statusText.textContent = ''; }, 1500);

    function formatDate(ds) {
      const d = new Date(ds);
      return d.toLocaleString('en-US', { month:'short' }) + ' ' + d.getDate() + ' ' + d.getFullYear();
    }

    addons.forEach((addon, idx) => {
      const row = document.createElement('div');
      row.className = 'sa-row';
      row.style.background = idx % 2 === 0 ? 'rgba(36,40,52,0.7)' : 'transparent';
      row.title = addon.description;

      const name = document.createElement('div');
      name.className = 'sa-name';
      name.textContent = addon.name;
      row.appendChild(name);

      const desc = document.createElement('div');
      desc.className = 'sa-desc';
      desc.textContent = addon.description;
      row.appendChild(desc);

      const author = document.createElement('div');
      author.className = 'sa-author';
      author.textContent = addon.Author || addon.author || '';
      row.appendChild(author);

      const date = document.createElement('div');
      date.className = 'sa-date ' + (addon.installed ? 'installed' : 'not-installed');
      date.textContent = addon.lastUpdated ? formatDate(addon.lastUpdated) : '—';
      row.appendChild(date);

      const actions = document.createElement('div');
      actions.className = 'sa-actions';

      if (!addon.installed) {
        const btn = document.createElement('button');
        btn.className = 'sa-btn sa-btn-install';
        btn.textContent = 'Install';
        btn.onclick = async (e) => {
          e.stopPropagation();
          btn.disabled = true;
          btn.textContent = 'Installing...';
          setProgress(30, 'Installing ' + addon.name + '...');
          const resp = await ipcRenderer.invoke('install-addon', addon, clientDir);
          if (!resp.success) {
            setProgress(0, 'Failed: ' + resp.message);
            btn.textContent = 'Install';
            btn.disabled = false;
          } else {
            setProgress(100, addon.name + ' installed');
            btn.textContent = 'Uninstall';
            btn.className = 'sa-btn sa-btn-uninstall';
            btn.disabled = false;
            date.textContent = formatDate(resp.lastUpdated);
            date.className = 'sa-date installed';
            addon.installed = true;
            addon.lastUpdated = resp.lastUpdated;
            const ic = addons.filter(a => a.installed).length;
            countLabel.textContent = ic + ' / ' + addons.length + ' installed';
            // Rebind as uninstall
            btn.onclick = makeUninstallHandler(btn, addon, date);
          }
        };
        actions.appendChild(btn);
      } else {
        const btn = document.createElement('button');
        btn.className = 'sa-btn sa-btn-uninstall';
        btn.textContent = 'Uninstall';
        btn.onclick = makeUninstallHandler(btn, addon, date);
        actions.appendChild(btn);
      }

      row.appendChild(actions);
      list.appendChild(row);
    });

    function makeUninstallHandler(btn, addon, dateEl) {
      return async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = 'Removing...';
        setProgress(30, 'Removing ' + addon.name + '...');
        const resp = await ipcRenderer.invoke('uninstall-addon', addon, clientDir);
        if (!resp.success) {
          setProgress(0, 'Failed: ' + resp.message);
          btn.textContent = 'Uninstall';
          btn.disabled = false;
        } else {
          setProgress(100, addon.name + ' removed');
          btn.textContent = 'Install';
          btn.className = 'sa-btn sa-btn-install';
          btn.disabled = false;
          dateEl.textContent = '\u2014';
          dateEl.className = 'sa-date not-installed';
          addon.installed = false;
          addon.lastUpdated = null;
          const ic = addons.filter(a => a.installed).length;
          countLabel.textContent = ic + ' / ' + addons.length + ' installed';
          // Rebind as install
          btn.onclick = async (e2) => {
            e2.stopPropagation();
            btn.disabled = true;
            btn.textContent = 'Installing...';
            setProgress(30, 'Installing ' + addon.name + '...');
            const resp2 = await ipcRenderer.invoke('install-addon', addon, clientDir);
            if (!resp2.success) {
              setProgress(0, 'Failed: ' + resp2.message);
              btn.textContent = 'Install';
              btn.disabled = false;
            } else {
              setProgress(100, addon.name + ' installed');
              btn.textContent = 'Uninstall';
              btn.className = 'sa-btn sa-btn-uninstall';
              btn.disabled = false;
              dateEl.textContent = formatDate(resp2.lastUpdated);
              dateEl.className = 'sa-date installed';
              addon.installed = true;
              addon.lastUpdated = resp2.lastUpdated;
              const ic2 = addons.filter(a => a.installed).length;
              countLabel.textContent = ic2 + ' / ' + addons.length + ' installed';
              btn.onclick = makeUninstallHandler(btn, addon, dateEl);
            }
          };
        }
      };
    }
  };
  document.body.appendChild(addonsBtn);
}


  const status = document.getElementById('status');
  const progressBar = document.getElementById('progress');
  const mainActions = document.getElementById('main-actions');
  const chooseExistingBtn = document.getElementById('chooseExistingBtn');
  const downloadClientBtn = document.getElementById('downloadClientBtn');
  const cancelDownloadBtn = document.getElementById('cancelDownloadBtn');

  // Ensure these buttons ignore drag (no-drag region)
  chooseExistingBtn.style['-webkit-app-region'] = 'no-drag';
  downloadClientBtn.style['-webkit-app-region'] = 'no-drag';

  const configExists = await ipcRenderer.invoke('check-config');
  const constants = await ipcRenderer.invoke('get-constants');

  function showStatus(msg) {
    status.innerText = msg;
    status.style.display = 'block';
  }
  function hideStatus() {
    status.style.display = 'none';
  }
  function showProgress() {
    progressBar.style.display = 'block';
    cancelDownloadBtn.style.display = 'inline-block';
  }
  function hideProgress() {
    progressBar.style.display = 'none';
    cancelDownloadBtn.style.display = 'none';
    progressBar.value = 0;
    progressBar.classList.remove('indeterminate');
    progressBar.removeAttribute('value');
  }

  let config = null;
  let clientDetected = false;
  if (configExists) {
    config = await ipcRenderer.invoke('load-config');
    // Check for patch updates before proceeding
    const updated = await checkAndUpdatePatch(config);
    if (updated) {
      // Reload config after update
      config = await ipcRenderer.invoke('load-config');
    }
    // If client is installed and clientDir is set, proceed to validate and update addons
    if (config && config.clientDir) {
      const isValid = await ipcRenderer.invoke('validate-wow-dir', config.clientDir);
      if (isValid) {
        // Hide the choose/download buttons during addon update
        mainActions.style.display = 'none';
        showStatus('Checking for addon updates...');
        progressBar.style.display = 'block';
        progressBar.removeAttribute('value'); // indeterminate initially
        progressBar.classList.add('indeterminate');

        // Listen for progress events from main process
        const progressHandler = (event, data) => {
          const pct = Math.round((data.current / data.total) * 100);
          progressBar.classList.remove('indeterminate');
          progressBar.value = pct;
          if (data.action === 'updating') {
            showStatus('Updating ' + data.name + '... (' + data.current + '/' + data.total + ')');
          } else {
            showStatus('Checking ' + data.name + '... (' + data.current + '/' + data.total + ')');
          }
        };
        ipcRenderer.on('addon-update-progress', progressHandler);

        await ipcRenderer.invoke('auto-update-addons', config.clientDir);

        ipcRenderer.removeListener('addon-update-progress', progressHandler);
        progressBar.style.display = 'none';
        progressBar.value = 0;
        // Reload config to get updated hash and state
        config = await ipcRenderer.invoke('load-config');
        // Now check for wowext.exe and show play button if present
        const fs = require('fs');
        const path = require('path');
        const wowExtExe = path.join(config.clientDir, 'wowext.exe');
        if (fs.existsSync(wowExtExe)) {
          showStatus('WoW client detected. Ready to launch Synastria!');
          hideProgress();
          mainActions.style.display = 'none';
          clientDetected = true;
          showPlayButton(config.clientDir);
          return;
        }
      }
    }
  }

  const clientNotDetectedDiv = document.getElementById('clientNotDetected');
  if (!clientDetected) {
    mainActions.style.display = 'block';
    clientNotDetectedDiv.style.display = 'block';
    hideStatus();
    hideProgress();
  } else {
    clientNotDetectedDiv.style.display = 'none';
  }

  chooseExistingBtn.onclick = async () => {
    const result = await ipcRenderer.invoke('select-directory');
    if (result && result.length > 0) {
      const chosenDir = result[0];
      const isValid = await ipcRenderer.invoke('validate-wow-dir', chosenDir);
      if (!isValid) {
        alert('Selected directory does not contain wow.exe or wowext.exe. Please select a valid WoW client folder.');
        return;
      }
      await ipcRenderer.invoke('save-config', { installed: true, clientDir: chosenDir });
      const fs = require('fs');
      const path = require('path');
      const wowExe = path.join(chosenDir, 'wow.exe');
      const wowExtExe = path.join(chosenDir, 'wowext.exe');
      if (fs.existsSync(wowExe) && !fs.existsSync(wowExtExe)) {
        showStatus('wowext.exe not found. Downloading patch...');
        try {
          const result = await ipcRenderer.invoke('download-and-install-patch', chosenDir);
          console.log('Patch download result:', result);
          showStatus(result.message);
          if (result.success) {
            showPlayButton(chosenDir);
          }
        } catch (err) {
          showStatus('Error downloading patch: ' + err.message);
        }
        mainActions.style.display = 'none';
      } else {
        showStatus('Existing WoW client directory saved! Ready to launch Synastria.');
        mainActions.style.display = 'none';
      }
    }
  };

  let currentClient = null;
  downloadClientBtn.onclick = async () => {
    const result = await ipcRenderer.invoke('select-directory');
    if (result && result.length > 0) {
      const destDir = result[0];
      mainActions.style.display = 'none';
      showStatus('Downloading client...');
      showProgress();
      const { extractClient } = require('./functions');
      const zipPath = require('path').join(destDir, constants.CLIENT_ZIP_FILE);
      let extractingInProgress = false;
      currentClient = downloadClientTorrent(
        constants.MAGNET_LINK,
        destDir,
        (percent) => {
          if (!extractingInProgress) {
            progressBar.value = percent;
            showStatus(`Downloading: ${percent}%`);
          }
        },
        async () => {
          extractingInProgress = true;
          progressBar.value = 100;
          hideProgress();
          showStatus('Extraction in Progress...');
          // Show indeterminate progress bar
          progressBar.classList.add('indeterminate');
          progressBar.removeAttribute('value');
          showProgress();
          setTimeout(() => {
            extractClient(zipPath, destDir, (movePercent) => {
              // Switch to determinate mode during file moves
              progressBar.classList.remove('indeterminate');
              progressBar.value = movePercent;
            })
              .then(async () => {
                extractingInProgress = false;
                showStatus('Extraction complete! Downloading patch...');
                try {
                  const result = await ipcRenderer.invoke('download-and-install-patch', destDir);
                  console.log('Patch download result:', result);
                  showStatus(result.message);
                  if (result.success) {
                    showPlayButton(destDir);
                  }
                } catch (err) {
                  showStatus('Error downloading patch: ' + err.message);
                }
                let config = await ipcRenderer.invoke('load-config') || {};
config.installed = true;
config.clientDir = destDir;
// patchVersion is preserved if already set by main.js after patching
await ipcRenderer.invoke('save-config', config);
                // Extraction and moves complete
                progressBar.value = 100;
                hideProgress();
                currentClient = null;
              })
              .catch((err) => {
                extractingInProgress = false;
                showStatus('Extraction failed: ' + err.message);
                hideProgress();
                currentClient = null;
              });
          }, 0);
        }
      );
    }
  };

  cancelDownloadBtn.onclick = () => {
    if (currentClient) {
      currentClient.destroy();
      showStatus('Download cancelled.');
      hideProgress();
      mainActions.style.display = 'block';
      currentClient = null;
    }
  };
});
