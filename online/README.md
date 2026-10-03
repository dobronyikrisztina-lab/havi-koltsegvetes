# Pénzügyeim – privát Google Apps Script kiadás

Ez a mappa a helyi/GitHub Pages változattól elkülönített, több eszközről használható online kiadást tartalmazza.

## Adattárolás

- A webalkalmazást kizárólag a tulajdonos Google-fiókja nyithatja meg.
- A tranzakciók, előfizetések, keretek és importnapló egy külön, privát Google-táblázatban tárolódnak.
- A tárolás A/B pillanatképeket, SHA-256 ellenőrzőösszeget, szerveroldali mezőellenőrzést, zárolást és revízióütközés-védelmet használ.
- A PDF szövegének feldolgozása a böngészőben történik. A jóváhagyott tranzakciók kerülnek a privát táblázatba.
- A helyi és az online adattár nem szinkronizál automatikusan. Az online változat közzététele után ezt érdemes elsődlegesnek használni.

## Építés és ellenőrzés

    node online/build.mjs
    node --check online/dist/client-check.js
    node --test tests/*.test.cjs online/storage.test.cjs

## Apps Script telepítés

1. Új önálló Apps Script projekt létrehozása.
2. Az online/dist/Code.gs, online/dist/Index.html és online/dist/appsscript.json fájl átmásolása.
3. Webalkalmazásként telepítés: Execute as me, Only myself.
4. Az engedélykérésben csak a Google-fiók e-mail-címe és a saját Google Táblázatok kezelése szerepelhet.
5. A telepített URL-en ellenőrizni kell a betöltést, a mentést, az újratöltés utáni tartósságot, az importot és az exportot.
6. Frissítéskor ugyanazt a telepítést új verzióra kell állítani, így a webcím változatlan marad.

