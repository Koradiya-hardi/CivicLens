# ---------- stage 1: build the static site ----------
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# The API address is baked into the JavaScript at BUILD time (Vite reads it then),
# so it is a build argument, not a runtime setting.
ARG VITE_API_URL=http://localhost:5001/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- stage 2: serve it with nginx ----------
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80