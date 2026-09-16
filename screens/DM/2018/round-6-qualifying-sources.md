# DMEC 2018 — Round 6 (Mondello Park) qualifying

Раунды 1–5: таблицы на driftmasters.gp есть в Wayback (импорт через `drift-masters-wp-qual.ts`).

**Round 6:** отдельной статьи `*qualifying-results*` в Internet Archive **не найдено**:

- перебраны типичные slug'и (`dmec-round-6-2018-qualifying-results`, `dmec-2018-round-6-…`, finale/mondello);
- просканированы WordPress post ID **4134–4300** (после R5 `p=4133`) — записей с «Qualifying Results» / «Round 6» нет;
- RawMotion: событие **DMEC 2018** отсутствует (есть только DMEC 2019+ с Mondello);
- OCR фото с [wheelsbywovka — Mondello 2018](https://blog.wheelsbywovka.com/drift-masters-european-championship-mondello-park/) — таблицы квалов нет (только баттлы/репортаж).

## Альтернативный официальный источник

- **YouTube (Drift Masters):** [DMEC Round 6 2018 – Qualifications](https://www.youtube.com/watch?v=cisiYh_q2bE) — трансляция/запись квалификации (таблица на экране, без HTML).
- Связанное: [Top 32 Battles](https://www.youtube.com/watch?v=EXuRvCRVnsc) — сетка после квалов.

## Как добавить в БД

1. Снять скрин таблицы из видео или вручную перенести строки.
2. Положить JSON: `screens/DM/2018/round-6-qualifying.json`:

```json
{
  "roundNumber": 6,
  "sourceUrl": "https://www.youtube.com/watch?v=cisiYh_q2bE",
  "rows": [
    { "rank": 1, "name": "James Deane", "bib": 130, "qualScore100": 96.0 }
  ]
}
```

3. Переимпорт: `npx tsx apps/api/scripts/import-drift-masters-archive.ts --year 2018`

Локальный JSON перекрывает Wayback для этого раунда.
