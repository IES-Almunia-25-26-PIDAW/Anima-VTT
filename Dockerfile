# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Frontend  (Node + pnpm → Vite build)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS frontend

RUN npm install -g pnpm@latest --silent

WORKDIR /work/client

# Copy workspace manifests first so the install layer is cached independently
# of source changes.
COPY client/pnpm-workspace.yaml        ./pnpm-workspace.yaml
COPY client/package.json               ./package.json
COPY client/pnpm-lock.yaml             ./pnpm-lock.yaml
COPY client/packages/shared/package.json  ./packages/shared/package.json
COPY client/packages/web/package.json     ./packages/web/package.json
COPY client/packages/desktop/package.json ./packages/desktop/package.json

# --ignore-scripts prevents @tauri-apps/cli from trying to download the Tauri
# binary (Linux host, wrong arch/OS for the desktop package we're not building).
RUN pnpm install --frozen-lockfile --ignore-scripts

# Copy source and build only the web package
COPY client/ .
RUN pnpm build:web

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Backend  (Maven + JDK → fat JAR)
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS backend

WORKDIR /work

# Resolve Maven dependencies before copying source (better cache reuse).
COPY Server/.mvn/  ./.mvn/
COPY Server/mvnw   ./mvnw
COPY Server/pom.xml ./pom.xml
# Fix Windows CRLF line endings so the shell script runs on Linux.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && \
    ./mvnw dependency:go-offline -q

COPY Server/src/ ./src/
RUN ./mvnw package -DskipTests -q

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — Runtime  (slim JRE)
# ─────────────────────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=backend  /work/target/*.jar                      ./app.jar
COPY --from=frontend /work/client/packages/web/dist/         ./static/

# /app/data  → SQLite database (mount as named volume)
# /app/uploads → user-uploaded images (mount as named volume)
RUN mkdir -p /app/data /app/uploads

EXPOSE 1000

# Activate the Docker Spring profile (see application-docker.properties)
ENV SPRING_PROFILES_ACTIVE=docker

ENTRYPOINT ["java", "-jar", "app.jar"]
