FROM mcr.microsoft.com/playwright:v1.42.1-jammy

WORKDIR /app

COPY package*.json ./

RUN npm install

# 🔴 ESTE PASO ES EL QUE FALTA
RUN npx playwright install --with-deps

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
