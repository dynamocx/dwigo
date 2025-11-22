# DWIGO - Deals Where I Go

DWIGO is a personalized savings platform that helps consumers save money at places they already go. The app uses AI-powered recommendations, location-based notifications, and gamification to create a comprehensive money-saving experience.

## Features

### Consumer Features
- **Personalized Deals**: AI-powered recommendations based on user preferences and behavior
- **Location-Based Notifications**: Get pinged when near relevant deals
- **DWIGO Agent**: AI travel and shopping concierge
- **Rewards Program**: Earn points for interactions and redeem for rewards
- **Preference Center**: Detailed customization of categories, brands, and locations
- **Vacation Planning**: Specialized travel recommendations and deals

### Merchant Features
- **Deal Management**: Easy creation and management of deals and offers
- **Analytics Dashboard**: Track deal performance and customer engagement
- **Webhook Integration & Adapters**: Connect with third-party platforms such as Groupon or Ticketmaster
- **Location Services**: Target customers based on proximity
- **Tiered Merchant Levels**: Crawl-only participation, self-service portals, promoted campaigns, and (future) marketplace transactions

### Technical Features
- **Machine Learning**: Personalized recommendations using user data
- **Real-time Notifications**: Location-based push notifications
- **Competitor Integration**: Connect with Groupon and other platforms
- **Mobile-First Design**: Responsive web app ready for mobile deployment

## Tech Stack

### Frontend
- React 18 with TypeScript
- Material-UI (MUI) for components
- React Router for navigation
- React Query for data fetching
- Framer Motion for animations
- React Hook Form for forms

### Backend
- Node.js with Express
- PostgreSQL database
- JWT authentication
- bcrypt for password hashing
- Socket.io for real-time features

### Database
- PostgreSQL with PostGIS-ready coordinates
- Comprehensive schema for users, merchants, deals, ingestion, and preferences
- Optimized indexes for performance and upcoming ingestion workloads

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+ (for background jobs)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd dwigo-cursor
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Set up the database**
   ```bash
   # Create PostgreSQL database
   createdb dwigo
   
   # Run the schema
   psql -d dwigo -f server/schema.sql
   ```

4. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. **Start the development servers**
   ```bash
   # Terminal A
   cd server
   npm run dev

   # Terminal B
   cd ../client
   npm run dev
   ```

This will start:
- Backend server on http://localhost:3001
- Frontend development server on http://localhost:5173
- Optional background worker via `npm run worker`

### Environment variables

Key values used by the new job/analytics infrastructure:

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://localhost:5432/dwigo` |
| `REDIS_URL` | Redis connection string | `redis://127.0.0.1:6379` |
| `ENABLE_SCHEDULER` | Start cron-based jobs inside the API process | `false` |
| `JOB_WORKER_CONCURRENCY` | Number of concurrent BullMQ workers | `5` |

## Project Structure

```
dwigo-cursor/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── App.tsx        # Main app component
│   └── package.json
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── middleware/       # Custom middleware
│   ├── config/           # Database & Redis configuration
│   ├── jobs/             # BullMQ queues, workers, schedulers
│   ├── schema.sql        # Database schema
│   └── index.js          # Server entry point
├── package.json          # Root package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

### Deals
- `GET /api/deals` - Get all deals
- `GET /api/deals/personalized` - Get personalized deals
- `GET /api/deals/:id` - Get specific deal
- `POST /api/deals/:id/save` - Save/unsave deal
- `POST /api/deals/:id/view` - Track deal view

### Ingestion (internal)
- `GET /api/ingestion/pending` - Fetch pending crawled deals for review and promotion workflows

### Preferences
- `GET /api/preferences` - Get user preferences
- `PUT /api/preferences` - Update preferences
- `POST /api/preferences/favorite-places` - Add favorite place
- `GET /api/preferences/favorite-places` - Get favorite places

### Location
- `POST /api/location/update` - Update user location
- `GET /api/location/nearby` - Get nearby deals
- `POST /api/location/notifications` - Set up location notifications

### Agents
- `GET /api/agents/recommendations` - Get AI recommendations
- `PUT /api/agents/preferences` - Update agent preferences

## Database Schema

The application uses a comprehensive PostgreSQL schema with the following main tables:

- **users**: Consumer user accounts
- **merchants**: Business merchant accounts (with participation level/status metadata)
- **merchant_locations / merchant_aliases**: Multi-location support and alias matching for ingestion
- **merchant_users / merchant_plans / merchant_settings**: Portal access, billing tiers, and preferences
- **merchant_integrations / merchant_assets**: Third-party connectors and uploaded creatives
- **deals**: Deals and offers (with status, visibility, sourcing metadata)
- **deal_schedules / deal_sources**: Structured scheduling and provenance tracking
- **user_preferences**: User preference settings
- **user_favorite_places**: User's favorite locations
- **user_deal_interactions**: Track user interactions with deals
- **user_rewards**: Points and rewards system
- **dwigo_agents**: AI agent configurations
- **location_notifications**: Location-based notification settings
- **feature_flags / feature_flag_overrides**: Toggle new surfaces for experiments
- **analytics_events**: Canonical event log for behavioural analytics
- **ingestion_jobs / ingested_deal_raw / ingestion_errors**: Level 1 ingestion pipeline bookkeeping
- **Guardrails**: Save/view endpoints enforce daily limits; location updates & alerts are rate limited to prevent spam

### Merchant Portal & Ingestion Blueprint

- **Level 1 (crawl only)**: `deal_sources`, `ingestion_jobs`, `ingested_deal_raw`, and `ingestion_errors` capture public promos, confidence scores, and diagnostic details. Imported merchants are marked with `status = 'imported'` and `level = 1`.
- **Level 2 (self-serve portal)**: `merchant_users`, `merchant_locations`, `merchant_settings`, and `merchant_assets` allow verified businesses to manage offers, locations, and creatives inside the DWIGO portal.
- **Level 3 (promotions & integrations)**: `merchant_plans` and `merchant_integrations` track campaign tiers, budgets, and third-party connectors (e.g., Groupon, Ticketmaster).
- **Level 4 (future marketplace)**: The schema leaves room for transactional tables (orders, payouts) without breaking current endpoints.

Ingestion is orchestrated via `ingestion_jobs`, with each job tracking the raw payload, normalization phase, error traces, and match decisions so manual QA or automated heuristics can approve deals before they go live.

> See [`docs/ingestion-plan.md`](docs/ingestion-plan.md) for the full Level 1 automation roadmap (source adapters, cron triggers, promotion heuristics, review tooling, and monitoring).

#### Seeding a pilot ingestion job

With Redis running and the worker process started (`npm run worker` inside `server/`), you can enqueue and promote sample Mid-Michigan crawl payloads:

```bash
cd server
npm run migrate:deals-status   # one-time migration to add status fields to existing deals
cd server
npm run ingest:seed
# optionally promote the pending entries into the live deals table
npm run ingest:promote -- --limit 10
# run a real crawler adapter (Lansing Brewing) and enqueue normalized payloads
npm run ingest:crawl:lansing
npm run ingest:promote -- --limit 10
```

The seed job persists raw entries in `ingested_deal_raw`, records ingestion stats, and logs any parsing errors. The promotion script performs lightweight matching/carving (creating `imported` merchants and locations when necessary) and inserts approved rows into the canonical `deals` table with provenance captured in `deal_sources`.

## Mobile Deployment

The web application is designed to be mobile-first and can be easily converted to native mobile apps:

### iOS (Xcode)
1. Use React Native or Capacitor to wrap the web app
2. Add native iOS features like push notifications
3. Implement location services for proximity notifications

### Android (Android Studio)
1. Use React Native or Capacitor for Android deployment
2. Add Android-specific features
3. Implement background location services

## Competitive Advantages

1. **AI-Powered Personalization**: Machine learning algorithms provide highly relevant recommendations
2. **Location Intelligence**: Proximity-based notifications and deals
3. **Comprehensive Platform**: Combines deals, travel planning, and lifestyle management
4. **Gamification**: Rewards system encourages engagement
5. **Competitor Integration**: Can integrate with existing platforms like Groupon
6. **Merchant-Friendly**: Easy-to-use merchant dashboard and webhook system

## Future Enhancements

- **Machine Learning**: Advanced recommendation algorithms
- **Social Features**: Share deals with friends and family
- **Group Deals**: Collaborative purchasing for better discounts
- **Voice Integration**: Voice-activated deal search
- **AR Features**: Augmented reality for in-store deal discovery
- **Blockchain**: Secure and transparent reward system

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please contact the development team or create an issue in the repository.
