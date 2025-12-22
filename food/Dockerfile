# 1) build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) serve (nginx)
FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html

# Cloud Run은 8080으로 들어오므로 nginx를 8080으로 돌리기 위한 설정
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
