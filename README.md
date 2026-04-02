# Meal-Planner

## Opis / Description
**PL:** Recipes to mobilna aplikacja webowa do zarządzania przepisami, składnikami i wartościami odżywczymi.  
Śledź kalorie, makroskładniki i plan posiłków w intuicyjnym interfejsie, dostosowanym do urządzeń mobilnych i desktopowych.  

**EN:** Recipes is a mobile-first web application for managing recipes, ingredients, and nutrition.  
Track calories, macronutrients, and meal plans efficiently in a user-friendly interface designed for both mobile and desktop.

---

## Funkcje / Features
**PL:**  
- Logowanie i bezpieczne zarządzanie kontem (Spring Security)  
- Dodawanie, edytowanie i usuwanie przepisów  
- Śledzenie składników i wartości odżywczych  
- Responsywny design (React + CSS)  
- Backend REST API (Spring Boot)  
- Integracja z bazą danych PostgreSQL/MySQL  
- Docker do łatwego wdrożenia  

**EN:**  
- User authentication and secure account management (Spring Security)  
- Add, edit, and delete recipes  
- Track ingredients and nutritional values  
- Mobile-friendly responsive design (React + CSS)  
- REST API backend with Spring Boot  
- PostgreSQL/MySQL database integration  
- Dockerized for easy deployment  

---

## Zrzuty ekranu / Screenshots
![Recipes Screenshot](link_do_zrzutu1.png)  
![Recipes Mobile View](link_do_zrzutu2.png)

---

## Tech Stack
**PL / EN:**  
- **Backend:** Java, Spring Boot, REST API  
- **Frontend:** React, JavaScript, HTML, CSS  
- **Baza danych / Database:** PostgreSQL, MySQL  
- **Narzędzia / Tools:** Maven, Docker, Postman, Git  

---

## Jak uruchomić / Getting Started

# Sklonuj repozytorium
git clone https://github.com/dominikdorawaa/Meal-Planner.git
cd mealPlanner

# Backend
cd backend
# Zainstaluj zależności i uruchom backend
mvn clean install
mvn spring-boot:run

# Frontend
cd frontend
# Zainstaluj zależności i uruchom frontend
npm install
npm start

