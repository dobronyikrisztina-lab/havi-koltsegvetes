# Pénzügyeim – Havi költségvetés

Helyben működő, magyar nyelvű pénzügyi nyilvántartó. A PDF-ek, tranzakciók és előfizetések nem kerülnek szerverre. A programkönyvtárak is a projektben vannak, nincs CDN-függés.

## Indítás

Node.js 22 vagy újabb szükséges. A projekt mappájában:

```sh
npm start
```

Nyisd meg: http://127.0.0.1:4173 . Nincs szükség `npm install` futtatására. A helyi szerver kizárólag az alkalmazás fájljait szolgálja ki; a kivonatokat és a `.local` mappát nem. HTML-fájlként dupla kattintással ne indítsd: a PDF-worker és a JavaScript-modulok HTTP-t igényelnek. Statikus tárhelyen (például GitHub Pages) a projekt gyökere közvetlenül használható.

## Használat

1. Válassz egy vagy több PDF-et vagy Excel-fájlt az **Import és export** részen.
2. Nézd át az előnézetet és az ellenőrzéseket. PDF-hiba vagy Excel-sorhiba esetén a teljes kiválasztott csomag mentése tiltott; nincs csendes részleges import.
3. Nyomd meg az **új tétel mentése** gombot. Az azonos fájl és a már meglévő tranzakció kiszűrésre kerül; két valódi azonos összegű vásárlás megmarad.
4. Válassz hónapot, számlát és pénznemet. Állíts be havi költési keretet, módosítsd a kategóriákat.
5. Erősítsd meg az előfizetés-javaslatokat, és pontosítsd a gyakoriságot, összeget, következő dátumot. Az ismétlődés becslés, nem banki előfizetés-azonosítás.
6. Készíts rendszeresen **JSON biztonsági mentést**. Ez a tranzakciókat, előfizetéseket, kereteket és importnyilvántartást is tartalmazza. Az Excel adatcserére szolgál; az előfizetéslapot az Excel-import nem állítja vissza.

## Támogatott kivonatok

- **Erste Max magyar hitelszámla-kivonat**, `HITELSZÁMLA FORGALOM` táblázattal. Külön könyvelési és tranzakciódátum. A terhelés/jóváírás oszlopból olvas, nem a dátumból, jutalompontból vagy egyenlegből.
- **Revolut magyar Egyedi kivonat**, személyes HUF és EUR számlák tranzakciótábláival. Oldalhatáron folytatódó tranzakciók, összevont PDF-szövegelemek, tizedesek, negatív előjelek kezelése.
- Minden PDF-nél nyitóegyenlegből induló tételenkénti egyenleglánc és nyomtatott összesítők ellenőrzése. Ismeretlen elrendezés vagy eltérés esetén nincs mentés.
- Beszkennelt, kép alapú PDF és más banki PDF-elrendezés jelenleg nem támogatott; OCR nincs.

## Excel

SheetJS-alapú `.xlsx` export és `.xlsx`, `.xls`, `.csv` import, saját oszlopformátummal. A `Tranzakciók` lapot olvassa, ennek hiányában az első lapot. Kötelező oszlopok: **Dátum, Leírás, Összeg, Pénznem**. A letölthető sablon üres és nem tartalmaz személyes adatot.

- Dátum: `2026-09-20`, `2026.09.20.` vagy natív Excel-dátumsorszám.
- Összeg: natív szám (ajánlott) vagy magyar szöveg, például `-12 345,67`. A pont ezreselválasztó; angol formátumú szöveges számot előbb alakíts Excel-számmá. Az összegképletek nem importálhatók.
- Pénznem: HUF vagy EUR. Számla és referencia szövegként megőrizve. Exportban összegek numerikusak, nem formázott szövegek.
- Az Excel formai ellenőrzése nem banki egyeztetés. Hibás sor esetén a mentés tiltott.
- Az exportált összes vagy szűrt tranzakció visszaimportálható, a már szereplő tételek kiszűrésével.

## Pénzügyi értelmezés és tárolás

- A HUF és EUR kimutatás külön fut, nincs automatikus vagy becsült árfolyam-konverzió. A Revolut által közölt HUF ellenérték csak tájékoztató adat a tételnél.
- A feltöltés, devizaváltás és felismert saját átutalás belső pénzmozgás. Más személynévvel jelzett saját utalást kézzel kell besorolni. A kategorizálás javaslat és bármikor módosítható.
- A bevételek a visszatérítéseket is tartalmazzák. Az időszaki eredmény nem számlaegyenleg, nem tartalmaz nyitóegyenleget vagy belső pénzmozgásokat.
- Előfizetésnél a havi becslés: éves díj / 12, heti díj × 52 / 12. Csak aktívként rögzített szolgáltatásokat összegez. A **Dátum előre** egy ciklussal léptet; a költéseket nem módosítja. Lemondás/szüneteltetés csak a nyilvántartást módosítja, a szolgáltatónál külön kell intézni.
- Az adatok `localStorage`-ban, böngészőhöz és webcímhez kötve tárolódnak. Másik böngésző, port vagy eszköz külön adatbázist jelent. A böngésző adatainak törlése elveszítheti a nyilvántartást. Felhős szinkron és háttérértesítés nincs.
- A régi `budget_transactions` változatlanul megmarad. A v2 új `budget_v2` kulcsot használ; a régi hibás összegeket új PDF-importtal lehet megbízhatóan helyettesíteni. A régi lista külön letölthető.

## Fejlesztés és ellenőrzés

```sh
npm test
```

A tesztek a magyar összegeket, dátumokat, duplikációkat, Excel bináris export/import kört, képletkezelést és hibás sorokat ellenőrzik. A `.local/statements.json` helyi, nem verziózott PDF.js-kimenet jelenlétekor a valós kivonatok teljes egyeztetése is lefut. Személyes kivonatot vagy kibontott tranzakciót ne commitolj. A `.gitignore` kizárja a helyi tesztadatokat és pénzügyi fájlokat.

A böngészős ellenőrzés lefedte a többfájlos PDF-importot, ismételt importot, Excel-visszaolvasást, keretet, előfizetésműveleteket, HTML-ként nem értelmezett leírásokat, újratöltést és mobil szélességet.

## Könyvtárak

- Mozilla PDF.js 5.6.205, Apache-2.0 (`vendor/PDFJS-LICENSE`).
- SheetJS CE 0.20.3, Apache-2.0 (`vendor/SHEETJS-LICENSE`). [Hivatalos telepítési dokumentáció](https://docs.sheetjs.com/docs/getting-started/installation/standalone/).

A `vendor` fájlok a rögzített kiadások változatlan, minifikált buildjei. Személyes adatot nem tartalmaznak.
