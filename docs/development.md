# Development guide

## Working in an IDE

Start only the database from Docker:

```bash
docker compose up -d postgres
```

The backend needs JDK 25 and reads settings from the same root `.env` as Docker Compose. Sample recipes and products are seeded into an empty database only with the `dev` profile active. Docker Compose enables it automatically; in an IDE set it in the run configuration (Active profiles: `dev`).

A non-empty `DATABASE_URL` in the `postgres://` format (as on Heroku) takes precedence over `DB_URL`, `DB_USERNAME` and `DB_PASSWORD` and always forces an SSL connection.

Recipe images are uploaded to the public `recipe-images` bucket in Supabase Storage, which requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Without them the rest of the app works and adding an image ends with an error message.

The frontend needs Node 24. In `frontend` run `npm install` and `npm run dev`. It connects to `http://localhost:8080` by default; set `VITE_API_URL` in the root `.env` to use another API address.

## Tests and coverage

| Part     | Command (in its directory) | Coverage report                        |
|----------|----------------------------|----------------------------------------|
| Backend  | `./mvnw test`              | `backend/target/site/jacoco/index.html` |
| Frontend | `npm run test:coverage`    | `frontend/coverage/index.html`          |

Backend tests use Testcontainers, so Docker must be running.

## Database migrations

Flyway manages the schema. Migrations live in `backend/src/main/resources/db/migration` and run when the backend starts. Every schema change is a new file with the next number (for example `V2__add_recipe_category.sql`) plus the matching entity change. Never edit a migration that has already reached `main`.

If the local database has tables without Flyway history, the backend will not start. Reset it with `docker compose down -v` and `docker compose up -d postgres`.

## Administrator account

New users get the `USER` role. The first administrator is granted manually in the database and the change applies from the next request:

```sql
UPDATE app_users SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

## Open Food Facts product import

Product data comes from [Open Food Facts](https://world.openfoodfacts.org) under the [ODbL](https://opendatacommons.org/licenses/odbl/1-0/) license. The app shows this attribution on the profile screen.

The import reads the JSONL dump from [Open Food Facts](https://world.openfoodfacts.org/data) (`openfoodfacts-products.jsonl.gz`) and filters products on its own: it keeps only products sold in Poland, with a Polish name, valid nutrition values and a unique barcode. The rules live in `OffImportRules` and `OffNameRules`, and the word lists used to recognize names in `backend/src/main/resources/off/`.

The import is repeatable: it creates no duplicates, does not overwrite products added by users and does not restore products deleted in the app. It removes Open Food Facts products that no longer pass the rules (products used in the diary are only hidden). At the end it prints a report with product counts, skip reasons and table size.

Locally (database from `docker compose`, settings from `.env`), in `backend`:

```bash
./mvnw -q spring-boot:run "-Dspring-boot.run.arguments=--off.import.file=/path/openfoodfacts-products.jsonl.gz --spring.main.web-application-type=none --spring.jpa.show-sql=false"
```

Against a remote database, set the database variables before the same command:

```bash
export DB_URL="jdbc:postgresql://db.example.com:5432/postgres?sslmode=require"
export DB_USERNAME="example-user"
export DB_PASSWORD="example-password"
export JWT_SECRET="any-text-for-the-import"
```

Preview the filtering result without a database (CSV with the rejection reason of every product):

```bash
./mvnw -q compile exec:java "-Dexec.args=/path/openfoodfacts-products.jsonl.gz candidates.csv"
```
