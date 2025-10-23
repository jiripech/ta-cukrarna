# Návod pro vyčištění favicon cache

## Problémy, které jsme vyřešili

1. ✅ **Hydratační chyba** - odstraněna problematická DynamicSections komponenta
2. ✅ **Image komponenta** - opraveno aspect ratio warning
3. ✅ **Service Worker cache** - aktualizován na verzi v5 s novými favicon
   soubory
4. ✅ **Favicon implementace** - všechny potřebné soubory a HTML linky jsou na
   místě

## Současný stav

- Server běží na <http://localhost:3000>
- Favicon soubory jsou dostupné:
  - `/favicon.ico` ✅ (25,931 bytes)
  - `/apple-touch-icon.png` ✅ (47,990 bytes)
- HTML obsahuje správné favicon odkazy ✅
- Žádné kompilační chyby ✅

## Kroky pro vyčištění Chrome cache

### Metoda 1: DevTools (doporučené)

1. Otevři <http://localhost:3000> v Chrome
2. Stiskni F12 nebo Cmd+Opt+I (otevře DevTools)
3. Pravý klik na refresh tlačítko v prohlížeči
4. Vyber "Empty Cache and Hard Reload"
5. Zavři DevTools

### Metoda 2: Application Storage

1. Otevři <http://localhost:3000> v Chrome
2. F12 → Application tab
3. V levém panelu klikni na "Storage"
4. Klikni "Clear site data"
5. Refresh stránku (Cmd+R)

### Metoda 3: Chrome Settings

1. Chrome → Settings → Privacy and Security → Clear browsing data
2. Vyber "Cached images and files"
3. Time range: "All time"
4. Clear data

### Metoda 4: Incognito (nejrychlejší test)

1. Cmd+Shift+N (nový incognito window)
2. Jdi na <http://localhost:3000>
3. Favicon by se měl zobrazit správně

## Co se změnilo

- Service Worker cache verze zvýšena na v5
- Přidány favicon soubory do SW cache
- Opravena Image komponenta (odstraněno CSS přepisování rozměrů)
- Hydratační problém vyřešen

Favicon **je** implementován správně - problém je pouze v Chrome cache!
