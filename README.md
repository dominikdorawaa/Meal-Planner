# Meal-Planner

## Uruchomienie lokalne

Wymagany jest Docker z Docker Compose.

1. Skopiuj `.env.example` do `.env` i uzupełnij wartości:
   - `DB_PASSWORD`: dowolne hasło do lokalnej bazy,
   - `JWT_SECRET`: losowy ciąg co najmniej 32 znaków.
2. Uruchom całą aplikację:

   ```bash
   docker compose up -d --build
   ```

| Usługa   | Adres                   |
|----------|-------------------------|
| Frontend | http://localhost:5173   |
| Backend  | http://localhost:8080   |
| Postgres | localhost:15433         |

Przy pierwszym starcie backend zakłada tabele migracjami Flyway i dodaje przykładowe przepisy oraz produkty. Dane bazy są trzymane w wolumenie `postgres18_data`, więc zostają po restarcie kontenerów. `docker compose down -v` usuwa je razem z wolumenem.

## Praca nad backendem lub frontendem

Żeby uruchamiać aplikację z IDE, wystarczy postawić samą bazę:

```bash
docker compose up -d postgres
```

Backend uruchamiany z IDE czyta ustawienia z `backend/.env`. Żeby połączył się z bazą z Dockera, ustaw w nim:

```
DB_URL=jdbc:postgresql://localhost:15433/mealplanner
DB_USERNAME=mealplanner
DB_PASSWORD=
JWT_SECRET=
```

`DB_PASSWORD` musi być takie samo jak w głównym `.env`, bo z tym hasłem Docker zakłada bazę.

Frontend uruchamiany przez `npm run dev` w katalogu `frontend` łączy się z `http://localhost:8080`. Inny adres API można podać w zmiennej `VITE_API_URL`.

## Schemat bazy i migracje

Schematem bazy zarządza Flyway. Migracje leżą w `backend/src/main/resources/db/migration` i są wykonywane przy starcie backendu, zarówno lokalnie, jak i na produkcji. Hibernate niczego w bazie nie zmienia, tylko sprawdza przy starcie, czy schemat zgadza się z encjami (`ddl-auto: validate`). Jeśli się nie zgadza, backend się nie uruchomi.

Zmiana schematu wygląda tak:

1. Dodaj nowy plik z kolejnym numerem, np. `V2__add_recipe_category.sql`.
2. Zmień encję w kodzie tak, żeby pasowała do nowego schematu.
3. Uruchom `mvn test` w katalogu `backend`. Testy stawiają czystą bazę Postgres w kontenerze, wykonują wszystkie migracje i sprawdzają, czy aplikacja startuje.

Nie edytuj migracji, która trafiła już na `main`. Każda zmiana to nowy plik.

Flyway uruchamia się tylko na pustej bazie albo na bazie, którą sam wcześniej założył. Jeśli baza ma tabele bez historii migracji, backend zatrzyma się z błędem `Found non-empty schema(s) "public" but no schema history table`. Lokalnie wystarczy wtedy wyczyścić bazę:

```bash
docker compose down -v
docker compose up -d postgres
```
