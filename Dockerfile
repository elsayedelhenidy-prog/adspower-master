FROM node:20-slim

WORKDIR /app

# Sab se pehle package.json copy karein (backend folder se)
COPY backend/package*.json ./

RUN npm install

# Phir baaki saara backend ka code copy karein
COPY backend/ .

EXPOSE 3001

CMD ["node", "server.js"]
