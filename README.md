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

Przy pierwszym starcie backend zakłada tabele i dodaje przykładowe przepisy oraz produkty. Dane bazy są trzymane w wolumenie `postgres_data`, więc zostają po restarcie kontenerów. `docker compose down -v` usuwa je razem z wolumenem.

## Praca nad backendem lub frontendem

Żeby uruchamiać aplikację z IDE, wystarczy postawić samą bazę:

```bash
docker compose up -d postgres
```

Backend domyślnie łączy się z bazą `mealplanner` na `localhost:15433` jako użytkownik `mealplanner`. W `backend/.env` ustaw `DB_PASSWORD` i `JWT_SECRET` na te same wartości co w głównym `.env`. Zmienne `DB_URL` i `DB_USERNAME` podawaj tylko wtedy, gdy chcesz użyć innej bazy.

Frontend uruchamiany przez `npm run dev` w katalogu `frontend` łączy się z `http://localhost:8080`. Inny adres API można podać w zmiennej `VITE_API_URL`.
