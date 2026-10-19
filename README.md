# Meal-Planner

Aplikacja do planowania posiłków: dzienny plan z kaloriami i makroskładnikami, baza przepisów i produktów oraz lista zakupów.

- Backend: Java 25, Spring Boot 4, PostgreSQL, migracje Flyway (`backend`)
- Frontend: React, TypeScript, Vite, Tailwind CSS (`frontend`)

## Uruchomienie lokalne

Wymagany jest Docker z Docker Compose.

1. Skopiuj `.env.example` do `.env` w katalogu głównym i uzupełnij `DB_PASSWORD` (dowolne hasło do lokalnej bazy) oraz `JWT_SECRET` (losowy ciąg co najmniej 32 znaków).
2. Uruchom aplikację:

   ```bash
   docker compose up -d --build
   ```

| Usługa   | Adres                 |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8080 |
| Postgres | localhost:15433       |

Dane bazy zostają po restarcie kontenerów. `docker compose down -v` usuwa je razem z wolumenem.

## Praca nad kodem

Do pracy w IDE wystarczy sama baza z Dockera:

```bash
docker compose up -d postgres
```

Backend wymaga JDK 25 i czyta ustawienia z tego samego głównego `.env` co Docker Compose. Przykładowe przepisy i produkty trafiają do pustej bazy tylko z aktywnym profilem `dev`, który Docker Compose włącza sam, a w IDE trzeba go ustawić w konfiguracji uruchomienia (Active profiles: `dev`). Testy uruchamia `mvn test` w katalogu `backend` i potrzebują działającego Dockera. Raport pokrycia JaCoCo powstaje w `backend/target/site/jacoco/index.html`. Zdjęcia przepisów backend wysyła do publicznego bucketu `recipe-images` w Supabase Storage, więc do uploadu potrzebuje `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`. Bez nich reszta aplikacji działa, a dodanie zdjęcia kończy się komunikatem o błędzie.

Frontend wymaga Node 24. W katalogu `frontend` uruchom `npm install` i `npm run dev`. Domyślnie łączy się z `http://localhost:8080`, inny adres API ustawia zmienna `VITE_API_URL` w głównym `.env`.

## Migracje bazy

Schematem bazy zarządza Flyway. Migracje są w `backend/src/main/resources/db/migration` i wykonują się przy starcie backendu. Każda zmiana schematu to nowy plik z kolejnym numerem (np. `V2__add_recipe_category.sql`) i pasująca do niego zmiana encji. Nie edytuj migracji, która trafiła już na `main`.

Jeśli lokalna baza ma tabele bez historii Flyway, backend się nie uruchomi. Wtedy wyczyść bazę przez `docker compose down -v` i `docker compose up -d postgres`.

## Konto administratora

Nowi użytkownicy dostają rolę `USER`. Pierwszego administratora nadaje się ręcznie w bazie, a zmiana działa od następnego żądania:

```sql
UPDATE app_users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

## Baza produktów z Open Food Facts

Dane produktów pochodzą z [Open Food Facts](https://world.openfoodfacts.org) i są dostępne na licencji [ODbL](https://opendatacommons.org/licenses/odbl/1-0/). Aplikacja pokazuje tę informację na ekranie profilu.

Import czyta zrzut JSONL z [Open Food Facts](https://world.openfoodfacts.org/data) (`openfoodfacts-products.jsonl.gz`) i sam odfiltrowuje produkty: zostają tylko sprzedawane w Polsce, z polską nazwą, poprawnymi wartościami odżywczymi i unikalnym kodem kreskowym. Reguły są w `OffImportRules`. Import można powtarzać: nie tworzy duplikatów, nie nadpisuje produktów dodanych przez użytkowników i nie przywraca produktów usuniętych w aplikacji. Na końcu wypisuje raport z liczbą produktów, powodami pominięcia i rozmiarem tabeli.

Lokalnie (baza z `docker compose`, dane z `.env`) w katalogu `backend`:

```bash
./mvnw -q spring-boot:run "-Dspring-boot.run.arguments=--off.import.file=/sciezka/openfoodfacts-products.jsonl.gz --spring.main.web-application-type=none --spring.jpa.show-sql=false"
```

Na Supabase ustaw zmienne bazy przed tym samym poleceniem (wartości z panelu Supabase, Connect, Session pooler):

```bash
export DB_URL="jdbc:postgresql://aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"
export DB_USERNAME="postgres.twoj-projekt"
export DB_PASSWORD="twoje-haslo"
export JWT_SECRET="dowolny-tekst-na-czas-importu"
```

Podgląd wyniku filtrowania bez bazy (CSV z powodem odrzucenia każdego produktu):

```bash
./mvnw -q compile exec:java "-Dexec.args=/sciezka/openfoodfacts-products.jsonl.gz candidates.csv"
```
