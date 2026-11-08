# Көркем — Накладные

invoice-jmix.herokuapp.com жүйесінің жаңа нұсқасы: фронтенд пен бэкенд бөлек.

```
backend/   Spring Boot 4 (Java 21) REST API + PostgreSQL + Flyway, JWT арқылы кіру
frontend/  React 19 + TypeScript + Vite
```

## Мүмкіндіктер

| Бөлім | Не істейді |
|---|---|
| Накладные | Тізім, нөмір/клиент бойынша іздеу, жасау/өзгерту/жою, тауар жолдары, басып шығару (Отчёт) |
| Клиенты | Имя, Адрес |
| Прайс-лист товаров | Категория бойынша топтау, фильтр, іздеу, Цена, Сортировка |
| Категории | Атауы, Сортировка |
| Пользователи | Логин, пароль, аты-жөні, email, белсенді |

Жол сомасы: `Цена × Количество × (1 − Скидка/100)`.
ҚҚС бағаның ішінде 12%: `НДС = Сумма × 12 / 112` (түпнұсқадағыдай). Есепті сервер жасайды.
Накладнойда тауар атауы сақталады — прайс-листтен тауар жойылса да накладной өзгермейді.

## Жергілікті іске қосу

Қажет: Java 21+, Node 20+, PostgreSQL.

```bash
createdb korkem_invoice
```

```bash
cd backend && ./mvnw spring-boot:run
```

```bash
cd frontend && npm install && npm run dev
```

Ашыңыз: http://localhost:5173 — логин `admin`, пароль `admin` (алғашқы іске қосуда автоматты жасалады; бірден ауыстырыңыз).

Бэкенд 8090 портында. Баптаулар (орта айнымалылары):

| Айнымалы | Әдепкі мәні |
|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/korkem_invoice` |
| `DB_USER` / `DB_PASSWORD` | жүйе пайдаланушысы / бос |
| `JWT_SECRET` | dev кілті — **production-да міндетті түрде ауыстырыңыз** (≥32 символ) |
| `ADMIN_PASSWORD` | `admin` |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `PORT` | `8090` |

Фронтенд бэкендке басқа доменде қосылса: `frontend/.env` ішінде `VITE_API_URL=https://api.example.kz`.

## Docker арқылы

```bash
docker compose up --build
```

Фронтенд: http://localhost:3000, API: http://localhost:8090.

## Тесттер

```bash
cd backend && ./mvnw test
```

## API (қысқаша)

Барлығы `Authorization: Bearer <token>` талап етеді (кіруден басқа).

```
POST   /api/auth/login            {username, password} → {token, user}
GET    /api/auth/me
GET    /api/clients?q=&page=&size=      POST / PUT /{id} / DELETE /{id}
GET    /api/categories?q=  /all         POST / PUT /{id} / DELETE /{id}
GET    /api/products?q=&categoryId=     POST / PUT /{id} / DELETE /{id}
GET    /api/invoices?q=&clientId=       GET /{id}  POST / PUT /{id} / DELETE /{id}
GET    /api/invoices/units
GET    /api/users                       POST / PUT /{id} / DELETE /{id}
```

## Ескі жүйеден деректерді көшіру

Ескі Jmix базасының (Heroku) деректерін жаңа базаға көшіреді: категориялар, тауарлар, клиенттер, накладнойлар және олардың жолдары.
Ескі жүйеде жойылған (`deleted_date`) жазбалар көшірілмейді. Жаңа базадағы бұл кестелер **тазаланады**, пайдаланушыларға тиіспейді.

```bash
docker run --rm -v "$PWD/old-db:/d" postgres:17-alpine pg_restore --no-owner --no-acl -f /d/old.sql /d/old.dump
```

```bash
createdb korkem_old && sed '/^SET transaction_timeout/d' old-db/old.sql | psql -q -d korkem_old
```

```bash
OLD_DB=korkem_old NEW_DB=korkem_invoice ./migration/migrate.sh
```

Скрипт соңында ескі және жаңа базадағы жазба сандары мен жалпы сомманы шығарады.
Ескі «Цена» скидка шегерілген баға болатын; жаңа жүйеде скидкаға дейінгі баға сақталады, ал ескі сомма мен НДС өзгеріссіз көшеді.
