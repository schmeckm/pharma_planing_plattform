FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_APP_URL=http://localhost
ENV VITE_APP_URL=$VITE_APP_URL

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
