# Көркем — Накладные

invoice-jmix.herokuapp.com жүйесінің жаңа нұсқасы: фронтенд пен бэкенд бөлек.

```
backend/   Spring Boot 4 (Java 21) REST API + PostgreSQL + Flyway, JWT арқылы кіру
frontend/  React 19 + TypeScript + Vite
```

## Мүмкіндіктер

| Бөлім | Не істейді |
|---|---|
| Жүкқұжаттар | Тізім, нөмір/клиент/кезең бойынша іздеу, төлем мәртебесі және «тек төленбегендер» сүзгісі; жасау, өзгерту, күнін таңдау; Қ-2 нысанын басып шығару |
| Төлемдер | Әр жүкқұжатқа бөлек, бірнеше бөлікпен; тәсілі (қолма-қол, карта, аударым); артық төлемге тыйым |
| Клиенттер | Аты, телефон, елді мекен/базар, мекенжай, ескертпе, бастапқы қарыз; клиент картасы (тарих, қарыз, жиі алатын тауарлар, «соңғыны қайталау»); қарызы барлар тізімі; телефоны бірдей клиенттер тізімі және біріктіру (соңғы жүкқұжаты жаңасы қалады, тек әкімші) |
| Баға тізімі | Санат бойынша топтау, сүзгі, іздеу; клиентке жіберетін баспа/PDF нұсқасы |
| Санаттар | Атауы, реті |
| Есептер | Басты бет (түсім, алынатын қарыз), тауарлар бойынша сатылым, CSV |
| Баптаулар | Ұйым деректері (атауы, БСН, мекенжай, телефон, қол қоюшылар) — тек әкімші |
| Пайдаланушылар | Логин, құпиясөз, аты-жөні, рөлі, белсенділігі |

Жол сомасы: `Баға × Саны × (1 − Жеңілдік/100)`. ҚҚС бағаның ішінде: `ҚҚС = Сома × r / (100 + r)`, `r` — `VAT_RATE`. Есепті сервер жасайды.
Жүкқұжатта тауар атауы сақталады — баға тізімінен тауар жойылса да жүкқұжат өзгермейді.

**Қарыз.** Клиенттің қарызы = бастапқы қарыз + төлемдер енгізілгеннен кейінгі жүкқұжаттардың төленбеген бөлігі.
Төлемдер енгізілген кезде бар болған барлық жүкқұжаттар төленген деп белгіленді (`V5__payments`); сол кездегі
ашық қарызды клиент картасындағы «Бастапқы қарыз» өрісіне қолмен енгізу керек.
Төлемі бар жүкқұжатты жоюға және сомасын төленгеннен азайтуға болмайды.

## Рөлдер

| Рөл | Не істей алады |
|---|---|
| `ADMIN` (Әкімші) | бәрі: пайдаланушылар, ұйым баптаулары, жазбалар мен төлемдерді жою |
| `MANAGER` (Менеджер) | жүкқұжаттар, төлем қабылдау, баға тізімі, санаттар, клиенттер, есептер; жоя алмайды, пайдаланушылар мен баптауларды көрмейді |

Бұғатталған немесе жойылған пайдаланушының токені бірден жарамсыз болады. Кемінде бір белсенді әкімші қалады.

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
| `APP_ENV` | `dev`. `prod` болса, әдепкі құпиялармен немесе `COOKIE_SECURE=false` болса сервер іске қосылмайды |
| `JWT_SECRET` | dev кілті — prod-та міндетті, кемінде 32 таңба (`openssl rand -base64 48`) |
| `COOKIE_SECURE` | `false` — prod-та `true` (тек HTTPS) |
| `ADMIN_PASSWORD` | `admin` — prod-та міндетті, кемінде 8 таңба |
| `VAT_RATE` | `12` — ҚҚС мөлшерлемесі, %, бағаның ішінде (тек жаңа және өзгертілген жолдарға әсер етеді) |
| `COMPANY_NAME`, `COMPANY_BIN`, `COMPANY_CHIEF_ACCOUNTANT`, `COMPANY_RELEASE_ALLOWED_BY` | Ұйым деректерінің бастапқы мәндері; «Баптаулар» бетінде бір рет сақталғаннан кейін дерекқордағы мәндер қолданылады |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `PORT` | `8090` |

Фронтенд бэкендке басқа доменде қосылса: `frontend/.env` ішінде `VITE_API_URL=https://api.example.kz`.

## Docker арқылы

```bash
cp .env.example .env
```

`.env` ішіндегі құпияларды толтырыңыз (`openssl rand -base64 48`), содан кейін:

```bash
docker compose up --build
```

Сыртқа тек nginx (`WEB_PORT`, әдепкі 3000) ашылады; дерекқор мен API ішкі желіде. Сайттың алдында HTTPS (TLS) болуы керек — сессия cookie-і тек HTTPS арқылы жіберіледі.

## Қауіпсіздік

- Кіргенде JWT **httpOnly, SameSite=Strict** cookie ретінде беріледі: JavaScript оны оқи алмайды, басқа сайттардан келген сұраныстарға қосылмайды (CSRF-тен қорғаныс). Сондықтан фронтенд пен API бір доменде болуы керек (nginx `/api` арқылы).
- Бір логинге 15 минут ішінде 5 сәтсіз әрекеттен кейін (бір IP-ден 20) кіру уақытша бұғатталады (429).
- Бұғатталған/жойылған пайдаланушының сессиясы бірден тоқтайды; рөл әр сұраныста базадан алынады.
- nginx: CSP (тек `'self'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`. Тақырыптар `frontend/security-headers.conf` файлында, әр `location`-ға қосылады. HSTS-ті TLS аяқталатын жерде қосыңыз.
- Roboto қаріпі жобаның ішінен беріледі (`@fontsource-variable/roboto`): үшінші тарап серверлеріне сұраныс жоқ.
- Бір қойындыдан шыққанда (немесе сессия аяқталғанда) басқа қойындылар да шығады.
- Бэкенд пен фронтенд (nginx-unprivileged, 8080 порты) контейнерлері root емес пайдаланушымен жұмыс істейді.

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
GET    /api/clients/{id}/summary  /{id}/last-invoice  /debtors?limit=  /duplicates
GET    /api/clients/merge-plan?clientId=&otherId=   POST /api/clients/merge (ADMIN)
GET    /api/categories?q=  /all         POST / PUT /{id} / DELETE /{id}
GET    /api/products?q=&categoryId=     POST / PUT /{id} / DELETE /{id}
GET    /api/invoices?q=&clientId=&from=&to=&dueOnly=   GET /{id}  POST / PUT /{id} / DELETE /{id}
GET    /api/invoices/{id}/payments      POST          DELETE /api/payments/{id}
GET    /api/settings                    PUT /api/settings/company (ADMIN)
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

## Дизайн-жүйе

Негізі — Mozaic (Леруа Мерлен / ADEO-ның ашық дизайн-жүйесі), бренд — Көркем.

- Токендер: [frontend/src/styles/tokens.css](frontend/src/styles/tokens.css) — шкалалар (`--kr-*`) және семантика (`--surface`, `--text`, `--brand` …), ашық және қараңғы тақырып.
- Компоненттер: [frontend/src/index.css](frontend/src/index.css) — тек семантикалық токендерді қолданады.
- Бренд-кітап, токендер және компонент превьюлері: https://claude.ai/artifact/FEehSNFQt3nnakUswiJZAv
