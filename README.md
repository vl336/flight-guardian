# Flight Guardian

Create a modern, clean, and responsive single-page web application (SPA) focused on flight delay risk analytics and statistics.

### Design & Visual Style:

- Inspired by Aviasales / Flightradar24: clean, fast, light-themed, travel-tech aesthetic.

- Color Palette: Deep navy blue primary (#0F172A), vibrant turquoise/blue accents (#0284C7), warning amber (#F59E0B), and risk red (#EF4444).

- High-contrast typography, crisp status badges, and clear data cards. No dark/cluttered elements. 

- Fully responsive for mobile devices (most traffic comes from smartphones).

### App Concept & Purpose:

This is an analytical tool that shows historical reliability and real-time delay risk predictions for flight routes, helping passengers assess the risk of flight delays before arriving at the airport.

No user authentication, login, or registration is required. Everything is accessible immediately.

### Data Model (Use Hardcoded Mock Data):

Create a JS/TS mock data generator that supports searching by flight number (e.g., "SU 1402", "S7 2054", "DP 405") or route (e.g., "Moscow -> Kazan", "Sochi -> Moscow").

Mock data should include:

- Flight details (Airline, Flight Number, Route, Scheduled Departure & Arrival).

- Historical stats: Punctuality rate (%), average delay in minutes, delay breakdown (% on-time, % 15-60m delay, % >60m delay/cancellation), most delayed day of the week.

- Real-time risk prediction: Risk Level ("LOW", "HIGH", "CRITICAL"), Delay Probability (%), Estimated delay duration.

- Risk factors list (e.g., "Inbound aircraft delay from previous leg: 45 min", "Adverse weather: Strong crosswind at destination").

### UI Sections & Layout:

1. Header / Navigation:

   - Logo: "FlightRisk" (with a sleek airplane/radar icon).

   - Tagline: "Аналитика и индекс риска задержки авиарейсов".

   - Minimal header without profile/auth buttons.

2. Hero Section (Search Area):

   - Headline: "Узнайте реальный риск задержки или отмены вашего рейса"

   - Subheadline: "Анализ цепочек бортов, метеоусловий и исторической пунктуальности до официального табло"

   - Search Bar Widget:

     - Input 1: Flight number or Route (with auto-suggestions dropdown for mock flights: SU 1402, S7 2054, DP 405, Moscow — Kazan, Sochi — Moscow).

     - Input 2: Date picker (default: Today).

     - Primary CTA Button: "Посмотреть аналитику рейса" (large, prominent blue button).

3. Flight Analytics Card (Appears after clicking search or selecting a flight):

   - Header: Flight Number, Airline Name, Route (SVO → KZN), Scheduled departure time.

   - Section A: Historical Reliability (Last 30 days)

     - Big score widget (e.g., "7.2 / 10" or "68% On-Time Rate").

     - Mini progress bars for delay distribution: On time (68%), 15-60 min (24%), >60 min (8%).

     - Highlight badge for the most problematic day (e.g., "⚠️ Пятница — самый частый день задержек").

   - Section B: Real-Time Risk Prediction (The Core Feature)

     - Risk Banner: High-contrast alert box (Green for LOW, Amber for HIGH, Red for CRITICAL).

     - Large percentage: "Риск задержки сегодня: 78% (HIGH)".

     - Expected Delay Range: "+40...60 минут от расписания".

     - Accordion / List of Risk Factors (Explainable AI):

       - 🔴 "Самолёт задерживается на предыдущем сегменте (рейс SU 1401 из Екатеринбурга, +45 мин)".

       - 🟡 "В аэропорту прилёта (Казань) прогнозируется сильный боковой ветер".

   - Section C: Conversion & Lead Capture Block

     - Card title: "Хотите следить за изменением риска по этому рейсу?"

     - Text: "Мы вышлем уведомление в Telegram, если самолёт задержится в предыдущем городе."

     - Action Element:

       - Single Input: Telegram Username or Email.

       - Button: "Подписаться на риск-алерты" (Show a nice mock success toast / confirmation state upon clicking).

### Interactivity & UX Details:

- When the user searches for a flight, show a brief loading state (1.5s spinner with messages like "Анализируем маршрут борта...", "Проверяем метеоусловия...") to make the analytical experience feel authentic.

- If no flight is searched yet, display a pre-loaded popular example card (e.g., SU 1402 Moscow — Kazan) so the page looks complete right away.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b358d5d8-54b6-409c-8aa7-3ccdd69b307f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
