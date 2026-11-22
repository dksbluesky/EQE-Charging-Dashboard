// Optional private cross-device sync. The browser keeps its existing local record format.
const SYNC_URL_KEY = 'eqe_sync_url';
const SYNC_KEY_KEY = 'eqe_sync_key';
const SYNC_REV_KEY = 'eqe_sync_revision';
const SYNC_BASE_KEY = 'eqe_sync_base';
const DEFAULT_SYNC_URL = 'https://eqe-charging-sync.dk0986.workers.dev';

function syncStatus(message) {
  document.getElementById('syncStatus').textContent = message;
}

function syncUrl() {
  const value = (localStorage.getItem(SYNC_URL_KEY) || DEFAULT_SYNC_URL).replace(/\/+$/, '');
  try { return new URL(value).protocol === 'https:' ? value : ''; } catch (_error) { return ''; }
}

function generateSyncKey() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  document.getElementById('syncKey').value = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  syncStatus('請儲存金鑰，並將同一組金鑰輸入其他裝置。遺失後無法復原雲端資料。');
}

async function copySyncKey() {
  const key = document.getElementById('syncKey').value.trim();
  if (!key) { syncStatus('請先產生或輸入配對金鑰。'); return; }
  try { await navigator.clipboard.writeText(key); syncStatus('金鑰已複製；請私下貼到另一台裝置。'); }
  catch (_error) { syncStatus('無法複製；請手動選取金鑰。'); }
}

function saveSyncSettings() {
  const url = document.getElementById('syncUrl').value.trim().replace(/\/+$/, '');
  const key = document.getElementById('syncKey').value.trim();
  if (!/^https:\/\//.test(url) || !/^[A-Za-z0-9_-]{43}$/.test(key)) {
    syncStatus('請輸入 HTTPS 服務網址及有效配對金鑰。');
    return;
  }
  if (url !== localStorage.getItem(SYNC_URL_KEY) || key !== localStorage.getItem(SYNC_KEY_KEY)) {
    localStorage.removeItem(SYNC_REV_KEY);
    localStorage.removeItem(SYNC_BASE_KEY);
  }
  localStorage.setItem(SYNC_URL_KEY, url);
  localStorage.setItem(SYNC_KEY_KEY, key);
  syncStatus('同步設定已儲存。請將金鑰保存在安全的地方。');
}

async function cloudRequest(method, revision, records) {
  const options = {
    method, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + localStorage.getItem(SYNC_KEY_KEY) }
  };
  if (method === 'PUT') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({ revision, records });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  options.signal = controller.signal;
  try { return await fetch(syncUrl() + '/v1/records', options); }
  finally { clearTimeout(timeout); }
}

function acceptCloud(records, revision) {
  if (!Array.isArray(records) || !Number.isInteger(revision)) throw new Error('雲端資料格式不正確');
  saveRecords(records);
  localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(records));
  localStorage.setItem(SYNC_REV_KEY, String(revision));
  renderRecordList();
  loadCharts(true);
}

async function syncChargingRecords() {
  if (!syncUrl() || !/^[A-Za-z0-9_-]{43}$/.test(localStorage.getItem(SYNC_KEY_KEY) || '')) {
    syncStatus('請先完成同步設定。');
    new bootstrap.Collapse(document.getElementById('syncSettings'), { show: true });
    return;
  }
  syncStatus('同步中…');
  try {
    const local = getRecords();
    const base = localStorage.getItem(SYNC_BASE_KEY);
    const knownRevision = Number(localStorage.getItem(SYNC_REV_KEY) || 0);
    const fetched = await cloudRequest('GET');
    if (fetched.status === 404) {
      if (knownRevision) throw new Error('雲端紀錄消失；請檢查金鑰或服務設定');
      if (!local.length) { syncStatus('本機與雲端皆無紀錄。'); return; }
      const sent = await cloudRequest('PUT', 0, local);
      if (!sent.ok) throw new Error('首次上傳失敗（HTTP ' + sent.status + '）');
      const result = await sent.json();
      localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(local));
      localStorage.setItem(SYNC_REV_KEY, String(result.revision));
      syncStatus('已上傳 ' + local.length + ' 筆紀錄。');
      return;
    }
    if (!fetched.ok) throw new Error('讀取失敗（HTTP ' + fetched.status + '）');
    const cloud = await fetched.json();
    if (!Array.isArray(cloud.records) || !Number.isInteger(cloud.revision)) throw new Error('雲端資料格式不正確');

    if (!base) {
      if (local.length && !confirm('此裝置已有紀錄，但尚未配對雲端。下載雲端紀錄並取代本機資料？請先匯出備份以保留本機版本。')) {
        syncStatus('已取消；本機紀錄未變更。'); return;
      }
      acceptCloud(cloud.records, cloud.revision);
      syncStatus('已下載 ' + cloud.records.length + ' 筆紀錄。');
      return;
    }
    const changedHere = JSON.stringify(local) !== base;
    if (changedHere && cloud.revision !== knownRevision) {
      syncStatus('兩台裝置都有新變更；請先匯出備份，再決定保留哪個版本。');
      return;
    }
    if (changedHere) {
      const sent = await cloudRequest('PUT', knownRevision, local);
      if (sent.status === 409) throw new Error('雲端剛剛更新，請重試並檢查衝突');
      if (!sent.ok) throw new Error('上傳失敗（HTTP ' + sent.status + '）');
      const result = await sent.json();
      localStorage.setItem(SYNC_BASE_KEY, JSON.stringify(local));
      localStorage.setItem(SYNC_REV_KEY, String(result.revision));
      syncStatus('已上傳 ' + local.length + ' 筆紀錄。');
    } else if (cloud.revision !== knownRevision) {
      acceptCloud(cloud.records, cloud.revision);
      syncStatus('已下載 ' + cloud.records.length + ' 筆紀錄。');
    } else syncStatus('已是最新資料（' + local.length + ' 筆）。');
  } catch (error) { syncStatus('同步失敗：' + error.message); }
}

document.getElementById('syncUrl').value = localStorage.getItem(SYNC_URL_KEY) || DEFAULT_SYNC_URL;
document.getElementById('syncKey').value = localStorage.getItem(SYNC_KEY_KEY) || '';
