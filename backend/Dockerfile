# ─── Stage 1: Build with Maven ────────────────────────────────
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder
WORKDIR /app

# Cache dependencies first
COPY pom.xml .
RUN mvn dependency:go-offline -q

# Build the app
COPY src ./src
RUN mvn clean package -DskipTests -q

# ─── Stage 2: Runtime (minimal JRE) ───────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Security: non-root user
RUN addgroup -S droneos && adduser -S droneos -G droneos
USER droneos

COPY --from=builder /app/target/*.jar app.jar

ENTRYPOINT ["java", \
  "-XX:+UseContainerSupport", \
  "-XX:MaxRAMPercentage=75.0", \
  "-XX:+UseG1GC", \
  "-Djava.security.egd=file:/dev/./urandom", \
  "-jar", "app.jar"]
