// Pénzügyeim – privát, tulajdonosi Google Apps Script háttér.
const OWNER_ = 'dobronyikrisztina@gmail.com';
const DB_PROPERTY_ = 'DATABASE_ID';
const ACTIVE_SLOT_PROPERTY_ = 'ACTIVE_SLOT';
const MAX_STATE_BYTES_ = 5000000;

function owner_() {
  const active = String(Session.getActiveUser().getEmail() || '').toLowerCase();
  const effective = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (active !== OWNER_ || effective !== OWNER_) throw Error('Csak a tulajdonos férhet hozzá.');
}

function doGet() {
  owner_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Pénzügyeim · Privát költségvetés')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function properties_() { return PropertiesService.getScriptProperties(); }

function locked_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}

function database_() {
  let id = properties_().getProperty(DB_PROPERTY_);
  if (!id) {
    const book = SpreadsheetApp.create('Pénzügyeim – privát adatok');
    id = book.getId();
    properties_().setProperty(DB_PROPERTY_, id);
    const first = book.getSheets()[0];
    first.setName('Tájékoztató');
    first.getRange('A1:B5').setValues([
      ['Pénzügyeim – privát adattár', 'Ezt a táblázatot az Apps Script webalkalmazás kezeli.'],
      ['Tulajdonos', OWNER_],
      ['Hozzáférés', 'Privát – ne oszd meg.'],
      ['Adatformátum', 'A/B ellenőrzött JSON-pillanatképek'],
      ['Frissítve', new Date()]
    ]);
    first.autoResizeColumns(1, 2);
  }
  return SpreadsheetApp.openById(id);
}

function blankState_() {
  return {version: 2, transactions: [], subscriptions: [], budgets: {}, dismissed: [], imports: []};
}

function blankRecord_() {
  return {revision: 0, updatedAt: null, state: blankState_()};
}

function validateState_(state) {
  if (!state || state.version !== 2 || !Array.isArray(state.transactions) ||
      !Array.isArray(state.subscriptions) || !state.budgets ||
      typeof state.budgets !== 'object' || Array.isArray(state.budgets) ||
      !Array.isArray(state.dismissed) || !Array.isArray(state.imports)) {
    throw Error('Nem támogatott vagy hiányos mentés.');
  }
  const ids = {};
  state.transactions.forEach(function(transaction) {
    if (!transaction || typeof transaction.id !== 'string' || !transaction.id || ids[transaction.id]) throw Error('Hiányzó vagy ismétlődő tranzakcióazonosító.');
    ids[transaction.id] = true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) || typeof transaction.desc !== 'string' ||
        typeof transaction.category !== 'string' || !Number.isFinite(transaction.amount) ||
        ['HUF', 'EUR'].indexOf(transaction.currency) < 0) throw Error('Hibás tranzakció.');
    if (transaction.account !== undefined && typeof transaction.account !== 'string') throw Error('Hibás forrásszámla.');
  });
  const subscriptionIds = {};
  state.subscriptions.forEach(function(subscription) {
    if (!subscription || typeof subscription.id !== 'string' || !subscription.id || subscriptionIds[subscription.id]) throw Error('Hiányzó vagy ismétlődő előfizetés-azonosító.');
    subscriptionIds[subscription.id] = true;
    if (typeof subscription.name !== 'string' || !subscription.name.trim() || !Number.isFinite(subscription.amount) || subscription.amount <= 0 ||
        ['HUF', 'EUR'].indexOf(subscription.currency) < 0 || ['monthly', 'weekly', 'yearly'].indexOf(subscription.cycle) < 0 ||
        ['active', 'paused', 'cancelled'].indexOf(subscription.status) < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(subscription.next)) throw Error('Hibás előfizetés.');
  });
  if (JSON.stringify(state).length > MAX_STATE_BYTES_) throw Error('Az adattár meghaladja az 5 MB-os védelmi korlátot.');
  return state;
}

function digest_(text) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8));
}

function readSlot_(book, name) {
  const sheet = book.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getDataRange().getDisplayValues();
  const text = rows.slice(1).map(function(row) { return JSON.parse(row[1]); }).join('');
  if (digest_(text) !== rows[0][1]) throw Error('Az adattár ellenőrzőösszege eltér; a másik példány használható.');
  const record = JSON.parse(text);
  validateState_(record.state);
  if (!Number.isSafeInteger(record.revision) || record.revision < 0) throw Error('Hibás adatverzió.');
  return record;
}

function writeSlot_(book, name, record) {
  const text = JSON.stringify(record);
  const rows = [['SHA256', digest_(text)]];
  for (let offset = 0; offset < text.length; offset += 12000) rows.push([String(offset / 12000), JSON.stringify(text.slice(offset, offset + 12000))]);
  const sheet = book.getSheetByName(name) || book.insertSheet(name);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
  SpreadsheetApp.flush();
  if (JSON.stringify(readSlot_(book, name)) !== text) throw Error('A mentés visszaolvasása nem egyezik.');
}

function readRecord_(book) {
  const preferred = properties_().getProperty(ACTIVE_SLOT_PROPERTY_) || 'A';
  try {
    return readSlot_(book, preferred) || readSlot_(book, preferred === 'A' ? 'B' : 'A') || blankRecord_();
  } catch (firstError) {
    const fallback = readSlot_(book, preferred === 'A' ? 'B' : 'A');
    if (fallback) return fallback;
    throw firstError;
  }
}

function publicRecord_(record, book) {
  return {revision: record.revision, updatedAt: record.updatedAt, state: record.state, sheetUrl: book.getUrl()};
}

function loadState() {
  owner_();
  return locked_(function() {
    const book = database_();
    return publicRecord_(readRecord_(book), book);
  });
}

function saveState(payload) {
  owner_();
  return locked_(function() {
    if (!payload || !Number.isSafeInteger(payload.expectedRevision)) throw Error('Hiányzó adatverzió.');
    const book = database_();
    const current = readRecord_(book);
    if (payload.expectedRevision !== current.revision) throw Error('Másik eszközön módosult az adattár. Frissítsd az oldalt, majd ismételd meg a módosítást.');
    const state = validateState_(JSON.parse(JSON.stringify(payload.state)));
    const next = {revision: current.revision + 1, updatedAt: new Date().toISOString(), state: state};
    const nextSlot = properties_().getProperty(ACTIVE_SLOT_PROPERTY_) === 'B' ? 'A' : 'B';
    writeSlot_(book, nextSlot, next);
    properties_().setProperty(ACTIVE_SLOT_PROPERTY_, nextSlot);
    const info = book.getSheetByName('Tájékoztató');
    if (info) info.getRange('B5').setValue(new Date());
    return {revision: next.revision, updatedAt: next.updatedAt, transactions: state.transactions.length};
  });
}

function getStorageInfo() {
  owner_();
  return locked_(function() {
    const book = database_();
    const record = readRecord_(book);
    return {sheetUrl: book.getUrl(), revision: record.revision, updatedAt: record.updatedAt, transactions: record.state.transactions.length};
  });
}

