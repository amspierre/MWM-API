# MWM API

REST API for the Mechanical Workshop Management system. It provides authentication, PostgreSQL persistence, and CRUD operations for the frontend.

## Requirements

- Node.js 20 or newer
- PostgreSQL 17 or 18
- npm

## Local setup

Install dependencies:

```powershell
npm install
```

Configure `.env` with the same PostgreSQL instance used by pgAdmin:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:root@localhost:5432/mwm
JWT_SECRET=dev-only-change-before-production
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5500,http://localhost:5173
```

Create the database if necessary, then apply the schema and development seed:

```powershell
$env:PGPASSWORD = 'root'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d postgres -c "CREATE DATABASE mwm;"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d mwm -f db\database.sql
```

If PostgreSQL 18 is the instance used by pgAdmin, replace `PostgreSQL\17` with `PostgreSQL\18`. The API and pgAdmin must use the same host, port, database, and PostgreSQL instance.

The development seed includes two clients, one staff member, one vehicle, one service order, and the login user `admin@oficina.com` with password `senha-segura`.

## Run the API

```powershell
npm start
```

Development mode with automatic restart:

```powershell
npm run dev
```

Base URL: `http://localhost:3000/api/v1`

Health check: `GET http://localhost:3000/health`

## Authentication

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "admin@oficina.com",
  "senha": "senha-segura"
}
```

Send the returned token with every protected request:

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
```

Additional endpoints: `GET /api/v1/auth/me` and `POST /api/v1/auth/logout`.

## Resources

All resource routes require authentication. Staff management requires the `admin` profile.

### Clients

```text
GET    /api/v1/clientes
GET    /api/v1/clientes/:id
POST   /api/v1/clientes
PATCH  /api/v1/clientes/:id
DELETE /api/v1/clientes/:id
GET    /api/v1/clientes/:cliente_id/veiculos
```

```json
{
  "nome": "Maria Oliveira",
  "cpf_cnpj": "111.222.333-44",
  "email": "maria@example.com",
  "telefone": "(49) 99999-9999",
  "endereco": "Central Street, 50"
}
```

### Staff

```text
GET    /api/v1/funcionarios
GET    /api/v1/funcionarios/:id
POST   /api/v1/funcionarios
PATCH  /api/v1/funcionarios/:id
DELETE /api/v1/funcionarios/:id
```

```json
{
  "nome": "Ana Souza",
  "cargo": "Mechanic",
  "matricula": "FUNC002"
}
```

### Vehicles

```text
GET    /api/v1/veiculos
GET    /api/v1/veiculos/:id
POST   /api/v1/veiculos
PATCH  /api/v1/veiculos/:id
DELETE /api/v1/veiculos/:id
```

```json
{
  "cliente_id": 1,
  "placa": "XYZ2A34",
  "marca": "Fiat",
  "modelo": "Uno",
  "cor": "White",
  "quilometragem": 45000,
  "ultima_visita": "2026-09-07",
  "carroceria": "Hatch"
}
```

### Service orders

```text
GET    /api/v1/ordens-servico
GET    /api/v1/ordens-servico/:id
POST   /api/v1/ordens-servico
PATCH  /api/v1/ordens-servico/:id
PATCH  /api/v1/ordens-servico/:id/status
DELETE /api/v1/ordens-servico/:id
```

```json
{
  "titulo": "General inspection",
  "cliente_id": 1,
  "veiculo_id": 1,
  "responsavel_id": 1,
  "status": "em_andamento",
  "data_inicio": "2026-09-07T08:30:00-03:00",
  "observacao": "Check brakes and oil.",
  "valor": 120.00
}
```

Valid statuses are `pendente`, `em_andamento`, and `finalizado`. When an order is finalized, the API fills `data_fim` and calculates `tempo_decorrido_minutos`.

## Pagination and filters

List responses use `{ "data": [], "meta": { "page": 1, "limit": 20, "total": 0, "pages": 0 } }`.

Clients, staff, and vehicles support `page`, `limit`, and `search`. Vehicles also support `cliente_id`. Service orders support `responsavel_id`, `cliente_id`, `veiculo_id`, `status`, `data_inicio_de`, `data_inicio_ate`, `valor_min`, `valor_max`, `sort`, `page`, and `limit`.

## Dashboard

```text
GET /api/v1/dashboard/resumo?de=2026-09-01&ate=2026-09-30
```

Returns open orders, total vehicles, active clients, and period revenue.

## Use from another frontend repository

Keep the projects separate:

```text
MWM-API/       -> Node.js API and PostgreSQL integration
MWM-FRONTEND/  -> web application consuming the API over HTTP
```

In the frontend repository:

```javascript
const API_URL = 'http://localhost:3000/api/v1';
const TOKEN_KEY = 'mwm_access_token';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || 'API request failed.');
  return payload;
}
```

The API allows frontend origins `http://localhost:5500` and `http://localhost:5173`. Add any other frontend origin to `CORS_ORIGIN` and restart the API. Serve the frontend over HTTP; do not open it with `file://`.

## Error responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid data.",
    "details": { "cliente_id": ["Related record not found."] }
  }
}
```

The API uses `401` for authentication failures, `403` for authorization failures, `404` for missing records, `409` for duplicate records, `422` for invalid input or relationships, and `500` for unexpected errors.

## Project structure

```text
app.js
backend/
  database.js
  http.js
  routes/
  services/
db/database.sql
```
