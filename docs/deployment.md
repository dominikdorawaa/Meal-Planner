# Wdrożenie i przeniesienie danych na Heroku

Backend i baza przechodzą z Render i Supabase Postgres na Heroku. Wartości sekretów są w menedżerze haseł, nie w repozytorium. Wszystkie adresy, hasła i klucze poniżej są przykładowe.

## Co gdzie działa

| Część | Usługa |
| --- | --- |
| Backend | Heroku, aplikacja `calendories`, region `eu`, stack `container` (obraz z `heroku.yml` i `backend/Dockerfile`), jedno dyno Basic |
| Baza danych | Heroku Postgres Essential-0 (limit 20 połączeń), adres w zmiennej `DATABASE_URL` |
| Zdjęcia przepisów | Supabase Storage, bucket `recipe-images` (bez zmian) |
| Frontend | Vercel (bez zmian) |
| Wdrażanie | GitHub Actions, `.github/workflows/deploy.yml` |

Budżet to kredyt studencki 13 USD miesięcznie: Basic kosztuje 7 USD, Essential-0 5 USD. Dlatego:

- tylko jedno dyno `web` typu Basic, bez dyno `worker` i bez skalowania w górę;
- tylko Essential-0, bez innych dodatków i droższych planów;
- nigdy nie używamy `heroku run`, bo jednorazowe dyno też są płatne. Polecenia SQL wykonujemy lokalnym `psql` z Dockera.

Pula połączeń backendu (`maximum-pool-size: 5`) mieści się w limicie bazy razem z ręcznym `psql` i `pg_restore`.

## Wdrażanie

Workflow `deploy.yml` uruchamia się po pushu na `main` i ręcznie (Actions, Deploy, Run workflow). Gdy zmienił się `backend/` lub `heroku.yml`, uruchamia testy backendu, robi `git push` do Heroku, które buduje obraz, a potem czeka na `200` z `/health`. Wymaga sekretu repozytorium `HEROKU_API_KEY` z osobnej autoryzacji:

```bash
heroku authorizations:create -d "GitHub Actions Calendories deploy"
```

Autoryzację odwołuje `heroku authorizations:revoke <id>`.

## Jednorazowa konfiguracja Heroku

```bash
heroku create calendories --region eu --stack container
heroku addons:create heroku-postgresql:essential-0 --version 18 -a calendories
heroku labs:enable log-runtime-metrics -a calendories
heroku pg:backups:schedule DATABASE_URL --at '03:00 Europe/Warsaw' -a calendories
```

Wersja w `--version` musi być co najmniej taka jak na Supabase (sekcja „Przeniesienie danych”, krok 1). Po pierwszym wdrożeniu ustaw typ dyno: `heroku ps:type web=basic -a calendories`.

Zmienne konfiguracyjne:

| Zmienna | Opis |
| --- | --- |
| `DATABASE_URL` | ustawia i rotuje Heroku; ma pierwszeństwo przed `DB_*` i wymusza SSL |
| `PORT` | ustawia Heroku |
| `JWT_SECRET` | ta sama wartość co na Render, wtedy użytkownicy zostają zalogowani |
| `JWT_EXPIRATION_MS` | opcjonalna, domyślnie 60 dni |
| `CORSALLOWEDORIGINS` | adres frontendu, kilka adresów oddzielonych przecinkami; bez niej działa tylko `http://localhost:5173` |
| `SUPABASE_URL` | adres projektu Supabase do zapisu zdjęć |
| `SUPABASE_SERVICE_ROLE_KEY` | klucz `service_role` z Supabase |
| `SUPABASE_RECIPE_IMAGES_BUCKET` | opcjonalna, domyślnie `recipe-images` |

```bash
read -rs JWT_SECRET && export JWT_SECRET
read -rs SUPABASE_SERVICE_ROLE_KEY && export SUPABASE_SERVICE_ROLE_KEY
heroku config:set -a calendories JWT_SECRET="$JWT_SECRET" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" SUPABASE_URL=https://twoj-projekt.supabase.co CORSALLOWEDORIGINS=https://twoj-frontend.example.com > /dev/null
```

Przekierowanie do `/dev/null` jest potrzebne, bo Heroku wypisuje ustawione wartości. Nie ustawiamy na Heroku `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` ani `SPRING_PROFILES_ACTIVE=dev` (profil `dev` dodaje przykładowe dane). Każda zmiana zmiennej restartuje dyno.

## Przeniesienie danych

Dane przenosimy ręcznie z własnego komputera, klientem Postgres z Dockera. Kopiujemy tylko schemat `public`: Supabase ma własne schematy (`auth`, `storage` i inne) i role, których przywrócenie na Heroku by się nie udało. Polecenia są dla Git Bash; `MSYS_NO_PATHCONV=1` chroni ścieżki kontenera przed zamianą na ścieżki Windows.

1. Adresy baz, bez zapisywania ich w plikach i historii. Adres Supabase pochodzi z panelu (Connect, Session pooler, port 5432), adres Heroku z `heroku config:get DATABASE_URL -a calendories`:

   ```bash
   read -rs SOURCE_URL && export SOURCE_URL
   read -rs TARGET_URL && export TARGET_URL
   export PGSSLMODE=require
   ```

   Przykładowa postać: `postgresql://postgres.twoj-projekt:haslo@aws-0-eu-central-1.pooler.supabase.com:5432/postgres` i `postgres://uzytkownik:haslo@przyklad.compute-1.amazonaws.com:5432/baza`. Adres skopiowany z panelu Supabase nie ma parametru `sslmode`, dlatego klient dostaje `PGSSLMODE=require` (`-e PGSSLMODE` w każdym `docker run`); parametr `sslmode` w adresie ma pierwszeństwo.

2. Wersje serwerów i rozszerzenia. Obraz `postgres:<major>` musi mieć wersję główną co najmniej taką jak nowszy z serwerów, np. `postgres:18` dla 17 i 18 (Heroku działa na 18):

   ```bash
   PG=postgres:18-alpine
   docker run --rm -e SOURCE_URL -e PGSSLMODE "$PG" sh -c 'psql "$SOURCE_URL" -Atc "SHOW server_version" -c "SELECT extname, extnamespace::regnamespace FROM pg_extension ORDER BY 1"'
   docker run --rm -e TARGET_URL -e PGSSLMODE "$PG" sh -c 'psql "$TARGET_URL" -Atc "SHOW server_version"'
   ```

   Zrzut schematu `public` nie zawiera rozszerzeń, a indeks wyszukiwania produktów wymaga `pg_trgm`. Zanotuj schemat, w którym jest ono na Supabase (`public` albo `extensions`).

3. Zatrzymanie zapisów: wstrzymaj backend na Render (Suspend), żeby nic nie zmieniło danych po zrzucie.

4. Zrzut z Supabase do pliku `calendories-public.dump` w bieżącym katalogu:

   ```bash
   MSYS_NO_PATHCONV=1 docker run --rm -e SOURCE_URL -e PGSSLMODE -v "$PWD:/work" -w /work "$PG" sh -c 'pg_dump "$SOURCE_URL" --schema=public --no-owner --no-privileges -Fc -f calendories-public.dump'
   ```

5. Wyczyszczenie bazy Heroku przy zatrzymanym dyno i utworzenie rozszerzenia w tym samym schemacie co na Supabase (dla `extensions`: `CREATE SCHEMA IF NOT EXISTS extensions; CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;`):

   ```bash
   heroku ps:scale web=0 -a calendories
   heroku pg:reset DATABASE_URL -a calendories --confirm calendories
   docker run --rm -e TARGET_URL -e PGSSLMODE "$PG" sh -c 'psql "$TARGET_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"'
   ```

6. Przywrócenie. Zrzut z `--schema=public` zawiera polecenie `CREATE SCHEMA public`, które na istniejącej bazie kończy się błędem `schema "public" already exists`, dlatego przywracamy według listy zawartości zrzutu bez wpisów schematu `public` i jego komentarza:

   ```bash
   MSYS_NO_PATHCONV=1 docker run --rm -e TARGET_URL -e PGSSLMODE -v "$PWD:/work" -w /work "$PG" sh -c 'pg_restore -l calendories-public.dump | grep -vE " (SCHEMA - public|COMMENT - SCHEMA public) " > /tmp/restore.list && pg_restore -L /tmp/restore.list --no-owner --no-privileges --exit-on-error -d "$TARGET_URL" calendories-public.dump'
   ```

7. Porównanie obu baz plikiem [`docs/sql/compare-databases.sql`](sql/compare-databases.sql), który wypisuje dokładną liczbę wierszy każdej tabeli i wartość każdej sekwencji w `public`. Polecenie uruchom w katalogu głównym repozytorium:

   ```bash
   MSYS_NO_PATHCONV=1 docker run --rm -e SOURCE_URL -e PGSSLMODE -v "$PWD/docs/sql:/sql:ro" "$PG" sh -c 'psql "$SOURCE_URL" -q -f /sql/compare-databases.sql' > source.txt
   MSYS_NO_PATHCONV=1 docker run --rm -e TARGET_URL -e PGSSLMODE -v "$PWD/docs/sql:/sql:ro" "$PG" sh -c 'psql "$TARGET_URL" -q -f /sql/compare-databases.sql' > target.txt
   diff source.txt target.txt && echo identical
   ```

8. Uruchomienie backendu i sprawdzenie:

   ```bash
   heroku ps:scale web=1 -a calendories
   heroku logs --tail -a calendories
   curl -fsS https://calendories-0123456789ab.herokuapp.com/health
   ```

   Właściwy adres aplikacji pokazuje `heroku apps:info -a calendories` (Web URL).

   W logach Flyway powinien zgłosić, że schemat jest aktualny, bez nowych migracji. Tabela historii Flyway (`flyway_schema_history`) jest w schemacie `public`, więc trafia do zrzutu razem z danymi. Flyway widzi na Heroku te same wykonane migracje i sumy kontrolne co na Supabase, a Hibernate (`ddl-auto: validate`) ten sam schemat.

9. Przełączenie frontendu: `VITE_API_URL` w ustawieniach projektu na Vercel wskazuje adres Heroku (nowy build po zmianie), a `CORSALLOWEDORIGINS` na Heroku zawiera adres frontendu. Potem sprawdź w przeglądarce logowanie, przepisy z dodaniem zdjęcia, produkty i plan dnia.

Plik zrzutu zawiera dane użytkowników. Nigdy go nie commitujemy (`*.dump` jest w `.gitignore`), a po udanym przełączeniu usuwamy razem z `source.txt` i `target.txt`.

## Powrót do starego środowiska

Do przełączenia stary backend na Render i baza Supabase pozostają nietknięte: zrzut tylko czyta dane. Przy problemie na Heroku wznów backend na Render (Resume) i przywróć poprzedni `VITE_API_URL` na Vercel. Dane zapisane na Heroku po przełączeniu nie wrócą wtedy same do Supabase. Usługę Render i bazę Supabase usuwamy dopiero po kilku dniach stabilnej pracy na Heroku i po pierwszej kopii zapasowej Heroku.

## Pamięć, logi i kopie zapasowe

`heroku.yml` uruchamia JVM z limitami pamięci dobranymi do 512 MB dyno Basic. Zużycie pamięci (`sample#memory_rss`, z `log-runtime-metrics`) i błędy `R14` pokazuje:

```bash
heroku logs --tail -a calendories
```

Essential-0 trzyma kopie z harmonogramu dziennego i do 5 kopii ręcznych:

```bash
heroku pg:backups -a calendories
heroku pg:backups:capture -a calendories
heroku pg:backups:download -a calendories
```

Przywrócenie kopii nadpisuje całą bazę: zatrzymaj dyno (`heroku ps:scale web=0`), uruchom `heroku pg:backups:restore <id> DATABASE_URL -a calendories`, a potem `heroku ps:scale web=1`.
