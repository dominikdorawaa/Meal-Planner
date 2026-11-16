# Calendories

[![Backend](https://github.com/dominikdorawaa/Meal-Planner/actions/workflows/backend.yml/badge.svg)](https://github.com/dominikdorawaa/Meal-Planner/actions/workflows/backend.yml)
[![Frontend](https://github.com/dominikdorawaa/Meal-Planner/actions/workflows/frontend.yml/badge.svg)](https://github.com/dominikdorawaa/Meal-Planner/actions/workflows/frontend.yml)
[![Deploy](https://github.com/dominikdorawaa/Meal-Planner/actions/workflows/deploy.yml/badge.svg)](https://github.com/dominikdorawaa/Meal-Planner/actions/workflows/deploy.yml)

**A phone-first meal planner that decides what you will eat, instead of logging what you already ate.**

Calendories lets you compose the coming days from recipes and products, shows calories and macros per meal and per day against a personal target, and turns recipes into a shopping list. It is an installable PWA built with Spring Boot and React, deployed to production and used daily by its author.

## Features

- **Daily and multi-day meal plan** with calories, protein, fat and carbs per meal and per day, plus copying and moving meals between days.
- **Personal calorie target** calculated from the user profile (Mifflin-St Jeor BMR, physical activity level and goal pace), collected in a short onboarding.
- **Recipe base** with ingredients, steps, portions and photos, with nutrition values computed from the ingredients.
- **Product database of Polish groceries** imported from Open Food Facts, with search, household measures and user-added products.
- **Barcode scanning** with the phone camera, falling back to a live Open Food Facts lookup for unknown products.
- **Shopping list** built from chosen recipes, with items to tick off in the shop.
- **Configurable meals** (names, order, visibility) that shape the plan rows.
- **Installable PWA** with dark, light and system themes, designed for one-handed use on a phone.

## Tech stack

| Area       | Technologies                                                                        |
|------------|-------------------------------------------------------------------------------------|
| Backend    | Java 25, Spring Boot 4, Spring Security, JWT, Spring Data JPA, Flyway, PostgreSQL    |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS, React Router, dnd-kit, vite-plugin-pwa      |
| Testing    | JUnit 5, Spring Boot Test, Testcontainers, JaCoCo, Vitest, Testing Library           |
| Delivery   | Docker Compose, GitHub Actions, Heroku (backend and database), Vercel (frontend)     |
| Storage    | Supabase Storage for recipe images                                                  |

## Architecture

```
React PWA (Vercel)  --REST + JWT-->  Spring Boot API (Heroku)  -->  PostgreSQL (Heroku)
                                          |
                                          +--> Open Food Facts API (barcode lookup)
                                          +--> Supabase Storage (recipe images)
```

The backend is organized by feature (`auth`, `meal`, `recipe`, `product`, `shoppinglist`, `user`, `off`), each with its own controller, service and repository. The frontend keeps screens in `pages`, reusable UI in `components` and pure, unit tested domain logic (nutrition, measures, plan dates, calorie target) in `lib`.

## Engineering highlights

- **Data import pipeline.** A repeatable importer streams the multi-gigabyte Open Food Facts dump, keeps only products sold in Poland with a Polish name, valid nutrition values and a unique barcode, and reports skip reasons. It never duplicates, overwrites user products or restores deleted ones.
- **Tested end to end.** Backend integration tests run against a real PostgreSQL in Testcontainers; the frontend has unit and component tests next to the code. Changes are held to at least 80% line coverage, and both reports are published by CI.
- **Continuous delivery.** Every pull request runs backend tests and frontend type checks and tests. Merges to `main` deploy the frontend to Vercel, and the backend to Heroku only when backend code changed, followed by a health check.
- **Safe schema evolution.** All schema and data changes go through versioned Flyway migrations that are never edited after release.
- **Security.** Stateless JWT authentication with token refresh, role-based access (`USER`, `ADMIN`) and rate limiting of outgoing Open Food Facts requests.
- **Internationalization.** The interface is translated (Polish by default, English available) while code and data stay in English.

## Getting started

Requirements: Docker with Docker Compose.

1. Copy `.env.example` to `.env` in the repository root and set `DB_PASSWORD` (any password for the local database) and `JWT_SECRET` (a random string of at least 32 characters).
2. Start the whole stack:

   ```bash
   docker compose up -d --build
   ```

| Service  | Address               |
|----------|-----------------------|
| Frontend | http://localhost:5173 |
| Backend  | http://localhost:8080 |
| Postgres | localhost:15433       |

The local setup seeds sample recipes and products. Data survives container restarts; `docker compose down -v` removes it together with the volume.

## Documentation

- [Development guide](docs/development.md): running parts in an IDE, tests and coverage, migrations, administrator account, Open Food Facts import
- [Deployment](docs/deployment.md): Heroku deployment and data migration

## Data attribution

Product data comes from [Open Food Facts](https://world.openfoodfacts.org) and is available under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
