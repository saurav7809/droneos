# ─── Stage 1: Dependency cache ────────────────────────────────
FROM eclipse-temurin:17-jdk-alpine AS deps
WORKDIR /app
RUN apk add --no-cache maven
COPY pom.xml .
RUN mvn dependency:go-offline -q

# ─── Stage 2: Build ───────────────────────────────────────────
FROM deps AS builder
COPY src ./src
RUN mvn clean package -DskipTests -q

# ─── Stage 3: Runtime (minimal JRE) ───────────────────────────
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Security: non-root user
RUN addgroup -S droneos && adduser -S droneos -G droneos
USER droneos

COPY --from=builder /app/target/*.jar app.jar

# JVM tuning for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UseG1GC \
               -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
