# Budowanie aplikacji używając obrazu z Mavenem
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Kopiowanie plików potrzebnych do zbudowania
COPY pom.xml .
COPY src ./src

# Budowanie paczki jar (z pominięciem testów dla przyspieszenia)
RUN mvn clean package -DskipTests

# Finalny obraz, lżejszy - samo środowisko uruchomieniowe (JRE)
FROM eclipse-temurin:17-jre
WORKDIR /app

# Skopiowanie wygenerowanego jara z pierwszego kroku
COPY --from=build /app/target/*.jar app.jar

# Wystawienie portu na którym działa domyślnie Spring Boot
EXPOSE 8080

# Komenda uruchamiająca naszą aplikację
ENTRYPOINT ["java", "-jar", "app.jar"]
