FROM maven:3.9.12-eclipse-temurin-25 AS build
WORKDIR /app

COPY pom.xml .
RUN mvn -B -q dependency:go-offline

COPY src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 10001 --create-home appuser

COPY --from=build /app/target/*.jar /app/app.jar

USER appuser
EXPOSE 8080

ENTRYPOINT []
CMD ["java", "-jar", "/app/app.jar"]
