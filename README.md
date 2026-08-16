# FinanzBlick

Responsive Web-App für persönliche Fixkosten, Einnahmen und Kategorien.

## Version 1 enthält

- Dashboard mit Monats- und Jahreskosten
- Einnahmenübersicht
- frei verwaltbare Kategorien
- Ausgaben anlegen/löschen
- automatische Monatsumrechnung bei jährlichen/halbjährlichen/vierteljährlichen Kosten
- lokale Speicherung im Browser
- JSON-Backup
- responsive iPhone-/Laptop-Ansicht
- Supabase-Login-Vorbereitung
- SQL-Schema mit Row Level Security
- GitHub-Pages-kompatible Vite-Konfiguration

## Lokal starten

```bash
npm install
npm run dev
```

## Supabase vorbereiten

1. Neues Supabase-Projekt erstellen.
2. `supabase/schema.sql` im SQL Editor ausführen.
3. `.env.example` nach `.env` kopieren.
4. Werte eintragen:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Die Werte findest du in Supabase unter Project Settings / API.

> Niemals den `service_role` Key im Frontend verwenden.

## GitHub Pages

Projekt bauen:

```bash
npm run build
```

Für eine automatische Veröffentlichung über GitHub Actions wird in der nächsten Version ein Workflow ergänzt.

## Nächster Ausbau

- vollständige Supabase-Synchronisierung für Kategorien, Ausgaben und Einnahmen
- Bearbeiten von Ausgaben
- sichere Löschlogik für Kategorien mit Zuordnung
- Zahlungs-/Vertragsdaten
- Fälligkeitskalender
- Diagramme
- Dark Mode
- PWA/Installation auf iPhone
- Import eines JSON-Backups
