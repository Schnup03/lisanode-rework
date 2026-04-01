/** Chrome & Firefox Browser Control via DevTools Protocol */
import http from 'http';
import https from 'https';
import { runPowerShell, psEscape } from '../ps-engine.mjs';

export const commands = {};

/** Make HTTP request to Chrome DevTools */
function chromeRequest(path) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:9222' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ tabs: [] }); }
      });
    });
    req.on('error', () => resolve({ tabs: [], error: 'Chrome not reachable' }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ tabs: [], error: 'Timeout' }); });
  });
}

function firefoxRequest(path) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:9222' + path, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ tabs: [] }); }
      });
    });
    req.on('error', () => resolve({ tabs: [], error: 'Firefox not reachable' }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ tabs: [], error: 'Timeout' }); });
  });
}

/* CHROME */
commands['chrome.tabs'] = async () => {
  const data = await chromeRequest('/json/list');
  if (data.error) return { tabs: [], error: data.error };
  return { tabs: data, debug_port: 9222 };
};

commands['chrome.findtab'] = async (params) => {
  const url = params?.url;
  const data = await chromeRequest('/json/list');
  if (data.error) return { found: false, tabs: [], error: data.error };
  const matched = (data || []).filter(t =>
    (url && t.url && t.url.includes(url)) ||
    (url && t.title && t.title.includes(url))
  );
  return { found: matched.length > 0, tabs: matched, all_tabs: data };
};

commands['chrome.activeurl'] = async () => {
  const data = await chromeRequest('/json');
  if (data.error) return { tabs: [], error: data.error };
  const active = (Array.isArray(data) ? data : [data]).filter(t => t.active);
  return { tabs: active };
};

commands['chrome.navigate'] = async (params) => {
  const { url, newTab = false } = params || {};
  if (!url) return { success: false, error: 'url required' };
  // Use Chrome remote debugging to navigate
  const data = await chromeRequest('/json/new?' + encodeURIComponent(url));
  if (data.error) {
    // Fallback: just open via shell
    await runPowerShell(`Start-Process chrome.exe '"${psEscape(url)}"'`);
    return { success: true, url, method: 'shell' };
  }
  return { success: true, url, tabId: data.id, method: 'devtools' };
};

commands['chrome.closeTab'] = async (params) => {
  const { tabId } = params || {};
  if (!tabId) return { success: false, error: 'tabId required' };
  await runPowerShell(`Invoke-RestMethod -Uri "http://localhost:9222/json/close/${psEscape(tabId)}" -Method GET`);
  return { success: true };
};

/* FIREFOX (via DevTools) */
commands['firefox.tabs'] = async () => {
  const data = await firefoxRequest('/json/list');
  if (data.error) return { tabs: [], error: data.error };
  return { tabs: data, debug_port: 9222 };
};

commands['firefox.navigate'] = async (params) => {
  const { url } = params || {};
  if (!url) return { success: false, error: 'url required' };
  await runPowerShell(`Start-Process firefox.exe '"${psEscape(url)}"'`);
  return { success: true, url };
};
