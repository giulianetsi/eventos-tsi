# execução local
Este repositório contém o backend (Node/Express) e o frontend (Create React App).
A configuração já vem preparada para desenvolvimento local com valores padrão.
- Backend: `node server.js` dentro da pasta `backend` (ou `npm start` dentro de `backend`)
- Frontend: `npm start` dentro da pasta `frontend`

Passos rápidos (PowerShell):

```powershell
# 1) Backend
cd backend
npm install
# Opcional: copie .env.example para .env e ajuste se quiser
# cp .env.example .env    # no PowerShell: Copy-Item .env.example .env
Copy-Item .env.example .env
node server.js

# 2) Em outro terminal, frontend
cd frontend
npm install
npm start
```

Ambiente e variáveis relevantes (apenas para desenvolvimento):
- `PORT` — porta do backend (padrão `5000`)
- `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` — conexão MySQL (padrões em `backend/db.js` são `localhost`, `root`, `changeme`, `pwa`).
- `FRONTEND_ORIGIN` — origem permitida pelo CORS (padrão `http://localhost:3000`).
- `PUBLIC_VAPID_KEY`, `PRIVATE_VAPID_KEY` — chaves para Web Push (opcional em dev; mostre aviso se ausentes).
- `SESSION_SECRET`, `JWT_SECRET` — segredos; `SESSION_SECRET` tem fallback em dev, `JWT_SECRET` também tem fallback em dev.

Observações:
- O backend já evita executar o worker de notificações agendadas em `NODE_ENV !== 'production'`.
- O frontend usa `REACT_APP_API_URL` para apontar a API. Por padrão aponta para `http://localhost:5000/api`.
- Se estiver usando MySQL local, crie a base de dados e tabelas conforme seu dump/`database.sql`.
