FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN npm i -g pnpm && (pnpm i || npm i)
COPY . .
CMD ["pnpm","dev"]