FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY routes ./routes
COPY controllers ./controllers
COPY services ./services
COPY engines ./engines
COPY agents ./agents
COPY events ./events
COPY knowledge-graph ./knowledge-graph
COPY websocket ./websocket
COPY providers ./providers
COPY middleware ./middleware
COPY utils ./utils
COPY swagger ./swagger
COPY data ./data

ENV HAP_DATA_DIR=/app/data
EXPOSE 8000

CMD ["node", "server.js"]
