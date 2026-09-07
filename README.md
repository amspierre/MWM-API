# MWM API

API REST do sistema **Mechanical Workshop Management**, responsável pelos dados da oficina mecânica e pelo acesso do frontend ao PostgreSQL.

## Requisitos

- Node.js 20 ou superior
- PostgreSQL 17 ou 18
- npm

## Configuração local

Instale as dependências:

```powershell
npm install
```

O arquivo `.env` deve conter a conexão da mesma instância PostgreSQL usada no pgAdmin:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:root@localhost:5432/mwm
JWT_SECRET=dev-only-change-before-production
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5500
```

> Use a mesma porta, versão/instância e banco no pgAdmin e na `DATABASE_URL`. Se o pgAdmin estiver conectado a outra instalação do PostgreSQL, ele poderá mostrar dados diferentes.

Crie o banco caso ele ainda não exista:

```powershell
$env:PGPASSWORD = 'root'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d postgres -c "CREATE DATABASE mwm;"
```

Execute a estrutura e o seed:

```powershell
$env:PGPASSWORD = 'root'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h localhost -d mwm -f db\database.sql
```

Se a instalação correta for PostgreSQL 18, troque `PostgreSQL\17` por `PostgreSQL\18` nos comandos. O banco de desenvolvimento é criado com:

- Cliente: João da Silva e Robson
- Funcionário: Carlos Oliveira
- Veículo: Volkswagen Gol, placa `ABC1D23`
- Ordem: Revisão geral
- Usuário: `admin@oficina.com`

## Executar a API

```powershell
npm start
```

Durante o desenvolvimento, com reinício automático:

```powershell
npm run dev
```

Base da API:

```text
http://localhost:3000/api/v1
```

Teste rápido:

```text
GET http://localhost:3000/health
```

Resposta esperada:

```json
{
	"status": "ok",
	"database": "ok"
}
```

## Autenticação

Faça login:

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

```json
{
	"email": "admin@oficina.com",
	"senha": "senha-segura"
}
```

A resposta contém `access_token`. Envie esse token em todas as rotas protegidas:

```http
Authorization: Bearer SEU_ACCESS_TOKEN
```

Também estão disponíveis:

```text
GET  /api/v1/auth/me
POST /api/v1/auth/logout
```

## Recursos disponíveis

Todas as rotas abaixo exigem autenticação, salvo `/health` e o login.

### Clientes

```text
GET    /api/v1/clientes
GET    /api/v1/clientes/:id
POST   /api/v1/clientes
PATCH  /api/v1/clientes/:id
DELETE /api/v1/clientes/:id
GET    /api/v1/clientes/:cliente_id/veiculos
```

Exemplo de criação:

```json
{
	"nome": "Maria Oliveira",
	"cpf_cnpj": "111.222.333-44",
	"email": "maria@example.com",
	"telefone": "(49) 99999-9999",
	"endereco": "Rua Central, 50"
}
```

### Funcionários

```text
GET    /api/v1/funcionarios
GET    /api/v1/funcionarios/:id
POST   /api/v1/funcionarios
PATCH  /api/v1/funcionarios/:id
DELETE /api/v1/funcionarios/:id
```

Essas operações exigem perfil `admin`.

```json
{
	"nome": "Ana Souza",
	"cargo": "Mecânica",
	"matricula": "FUNC002"
}
```

### Veículos

```text
GET    /api/v1/veiculos
GET    /api/v1/veiculos/:id
POST   /api/v1/veiculos
PATCH  /api/v1/veiculos/:id
DELETE /api/v1/veiculos/:id
```

Exemplo de criação:

```json
{
	"cliente_id": 1,
	"placa": "XYZ2A34",
	"marca": "Fiat",
	"modelo": "Uno",
	"cor": "Branco",
	"quilometragem": 45000,
	"ultima_visita": "2026-09-07",
	"carroceria": "Hatch"
}
```

A placa é convertida para maiúsculas. O `cliente_id` deve existir.

### Ordens de serviço

```text
GET    /api/v1/ordens-servico
GET    /api/v1/ordens-servico/:id
POST   /api/v1/ordens-servico
PATCH  /api/v1/ordens-servico/:id
PATCH  /api/v1/ordens-servico/:id/status
DELETE /api/v1/ordens-servico/:id
```

Exemplo de criação:

```json
{
	"titulo": "Revisão geral",
	"cliente_id": 1,
	"veiculo_id": 1,
	"responsavel_id": 1,
	"status": "em_andamento",
	"data_inicio": "2026-09-07T08:30:00-03:00",
	"observacao": "Verificar freios e óleo.",
	"valor": 120.00
}
```

Status permitidos: `pendente`, `em_andamento` e `finalizado`.

Para finalizar uma ordem:

```http
PATCH /api/v1/ordens-servico/1/status
Content-Type: application/json
Authorization: Bearer SEU_ACCESS_TOKEN
```

```json
{
	"status": "finalizado"
}
```

A API preenche `data_fim` e calcula `tempo_decorrido_minutos` automaticamente.

## Listagens, filtros e paginação

As listagens retornam:

```json
{
	"data": [],
	"meta": {
		"page": 1,
		"limit": 20,
		"total": 0,
		"pages": 0
	}
}
```

Clientes, funcionários e veículos aceitam:

```text
?page=1&limit=20&search=fiat
```

Veículos também aceitam:

```text
?cliente_id=1
```

Ordens de serviço aceitam:

```text
?status=em_andamento
&cliente_id=1
&veiculo_id=1
&responsavel_id=1
&data_inicio_de=2026-09-01
&data_inicio_ate=2026-09-30
&valor_min=50
&valor_max=500
&sort=data_inicio_desc
&page=1&limit=20
```

## Dashboard

```text
GET /api/v1/dashboard/resumo?de=2026-09-01&ate=2026-09-30
```

Retorna ordens abertas, total de veículos, clientes ativos e receita do período.

## Usar a API em outro repositório

O frontend não precisa estar dentro deste repositório. Mantenha os projetos separados:

```text
MWM-API/       -> servidor Node + PostgreSQL
MWM-FRONTEND/  -> aplicação web que consome a API por HTTP
```

Inicie a API neste repositório:

```powershell
cd caminho\para\MWM-API
npm start
```

Depois, no repositório do frontend, use esta URL base:

```javascript
const API_URL = 'http://localhost:3000/api/v1';
```

O frontend pode usar Vite, Live Server, Python HTTP server ou qualquer outro servidor. As origens locais já permitidas são `http://localhost:5500` e `http://localhost:5173`. Para outra porta, adicione-a ao `CORS_ORIGIN` do `.env` da API e reinicie o servidor:

```env
CORS_ORIGIN=http://localhost:5500,http://localhost:5173,http://localhost:4200
```

Não abra o frontend diretamente com `file://`. Sirva-o por HTTP para que as requisições e o CORS funcionem.

No repositório do frontend, guarde o token recebido no login e crie uma função comum para as requisições:

```javascript
async function apiFetch(path, options = {}) {
	const token = localStorage.getItem('mwm_access_token');
	const response = await fetch(`${API_URL}${path}`, {
		...options,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers || {})
		}
	});

	if (!response.ok) {
		const error = await response.json().catch(() => ({}));
		throw new Error(error.error?.message || 'Erro na API.');
	}

	return response.status === 204 ? null : response.json();
}
```

Login no frontend:

```javascript
const result = await apiFetch('/auth/login', {
	method: 'POST',
	body: JSON.stringify({
		email: 'admin@oficina.com',
		senha: 'senha-segura'
	})
});

localStorage.setItem('mwm_access_token', result.access_token);
```

Listar veículos:

```javascript
const result = await apiFetch('/veiculos?limit=100');
const veiculos = result.data;
```

Adicionar veículo:

```javascript
await apiFetch('/veiculos', {
	method: 'POST',
	body: JSON.stringify({
		cliente_id: 1,
		placa: 'XYZ2A34',
		marca: 'Fiat',
		modelo: 'Uno',
		cor: 'Branco',
		quilometragem: 45000,
		carroceria: 'Hatch'
	})
});
```

Se o frontend for acessado por outro computador da rede, `localhost` não aponta para o computador da API. Use o IP da máquina que executa o Node, por exemplo:

```javascript
const API_URL = 'http://192.168.0.20:3000/api/v1';
```

Nesse caso, inclua a origem real do frontend no `CORS_ORIGIN` e libere a porta `3000` no firewall, se necessário. Em produção, substitua essa URL por um domínio HTTPS, como `https://api.sua-oficina.com/api/v1`.

Durante o desenvolvimento, sirva o frontend estático em outra porta:

```powershell
cd ..\Mechanical-Workshop-Management-MWM-\frontend\home-page
python -m http.server 5500
```

Abra `http://localhost:5500/home-page.html`. O CORS da API já permite essa origem.

## Respostas de erro

Os erros seguem este formato:

```json
{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Dados inválidos.",
		"details": {
			"cliente_id": ["Registro relacionado não encontrado."]
		}
	}
}
```

Status usados:

- `401`: token ausente ou inválido
- `403`: usuário sem permissão
- `404`: registro ou rota não encontrada
- `409`: duplicidade, como CPF/CNPJ, matrícula ou placa
- `422`: payload ou relacionamento inválido
- `500`: erro interno

## Estrutura do projeto

```text
app.js
backend/
	database.js
	http.js
	routes/
		clients.js
		staff.js
		vehicles.js
		service-orders.js
	services/
		clients.js
		staff.js
		vehicles.js
		service-orders.js
db/
	database.sql
```
