# Winners found by Manus (Mete's 11:54 brief)

Status 12:30: no results. The Manus account ran out of credits.
- Hound https://manus.im/app/fzzYLXm9XTdvKQLjVGF9nX, a.clinic https://manus.im/app/Yawd4sK2jtrGThHN7YroX5, Dynova https://manus.im/app/Nu3dpUd2jy6jMUQw9u4vxx: started 12:01, ended with "You don't have enough credits".
- Camplan (floor-plan / room-measuring apps: magicplan, Polycam, RoomScan, Planner 5D, CubiCasa, Canvas): refused at start, `task.create` HTTP 429 "credit limit exceeded".
- To run them after a top-up: `pnpm exec tsx demo/manus.ts hunt hound aclinic dynova camplan` (delete the old entries under "hunts" in src/lib/client/manus-tasks.json first), then `pnpm exec tsx demo/manus.ts status` rewrites this file with the structured results (kind, brand, platform, format, days running, views, URL, why it wins).
