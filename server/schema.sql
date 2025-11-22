-- DWIGO Database Schema

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    location_enabled BOOLEAN DEFAULT false,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Merchants table
CREATE TABLE merchants (
    id SERIAL PRIMARY KEY,
    business_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    contact_name VARCHAR(255),
    phone VARCHAR(20),
    business_type VARCHAR(100),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    description TEXT,
    website VARCHAR(255),
    status VARCHAR(20) DEFAULT 'imported', -- imported, active, suspended, archived
    level SMALLINT DEFAULT 1, -- Level 1-4 participation
    external_id VARCHAR(100),
    source_metadata JSONB,
    claimed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_locations (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    name VARCHAR(255),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'USA',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    timezone VARCHAR(100),
    open_hours JSONB,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_aliases (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    alias VARCHAR(255) NOT NULL,
    confidence NUMERIC(5, 2),
    source VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_users (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'owner', -- owner, manager, analyst
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    invited_at TIMESTAMP,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_settings (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    notification_prefs JSONB,
    auto_renew_deals BOOLEAN DEFAULT true,
    default_audience VARCHAR(100),
    default_budget NUMERIC(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_plans (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    plan VARCHAR(50) NOT NULL, -- free, promo, marketplace
    status VARCHAR(20) DEFAULT 'active',
    starts_at TIMESTAMP DEFAULT NOW(),
    ends_at TIMESTAMP,
    billing_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_integrations (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL, -- groupon, ticketmaster, etc.
    credentials JSONB,
    sync_status VARCHAR(20) DEFAULT 'pending',
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE merchant_assets (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    asset_type VARCHAR(50) NOT NULL, -- logo, hero, menu
    storage_path VARCHAR(500) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending_review',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Deals table
CREATE TABLE deals (
    id SERIAL PRIMARY KEY,
    merchant_id INTEGER REFERENCES merchants(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES merchant_locations(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    original_price DECIMAL(10, 2),
    deal_price DECIMAL(10, 2),
    discount_percentage DECIMAL(5, 2),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    max_redemptions INTEGER,
    current_redemptions INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- pending_review, active, paused, expired, archived
    visibility VARCHAR(20) DEFAULT 'public', -- public, featured, private
    source_type VARCHAR(50), -- web_crawl, portal, integration
    source_reference VARCHAR(255),
    source_details JSONB,
    confidence_score NUMERIC(5,2),
    last_seen_at TIMESTAMP,
    inventory_remaining INTEGER,
    image_url VARCHAR(500),
    terms_conditions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE deal_schedules (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    schedule_type VARCHAR(50) NOT NULL, -- one_time, recurring_weekly, recurring_daily
    schedule_rule JSONB,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE deal_sources (
    id SERIAL PRIMARY KEY,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    source VARCHAR(100) NOT NULL,
    raw_url VARCHAR(500),
    fetched_at TIMESTAMP,
    confidence NUMERIC(5,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User preferences table
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preferred_categories JSONB,
    preferred_brands JSONB,
    preferred_locations JSONB,
    budget_preferences JSONB,
    notification_settings JSONB,
    travel_preferences JSONB,
    privacy_settings JSONB DEFAULT '{}'::jsonb,
    consent_version VARCHAR(50),
    consent_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User favorite places
CREATE TABLE user_favorite_places (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    place_name VARCHAR(255) NOT NULL,
    place_type VARCHAR(100), -- restaurant, store, entertainment, etc.
    address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    category VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- User deal interactions
CREATE TABLE user_deal_interactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50), -- viewed, saved, redeemed, shared
    created_at TIMESTAMP DEFAULT NOW()
);

-- User rewards/points
CREATE TABLE user_rewards (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    points_earned INTEGER DEFAULT 0,
    points_redeemed INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- DWIGO Agents (AI recommendations)
CREATE TABLE dwigo_agents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    agent_type VARCHAR(50), -- vacation, local, shopping, etc.
    preferences JSONB,
    recommendations JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Location-based notifications
CREATE TABLE location_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius_meters INTEGER DEFAULT 1000,
    notification_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Competitor integrations
CREATE TABLE competitor_integrations (
    id SERIAL PRIMARY KEY,
    platform_name VARCHAR(100), -- Groupon, LivingSocial, etc.
    api_endpoint VARCHAR(500),
    api_key VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    sync_frequency INTEGER DEFAULT 3600, -- seconds
    last_sync TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Feature flags
CREATE TABLE feature_flags (
    flag_key VARCHAR(100) PRIMARY KEY,
    description TEXT,
    enabled BOOLEAN DEFAULT false,
    rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE feature_flag_overrides (
    id SERIAL PRIMARY KEY,
    flag_key VARCHAR(100) REFERENCES feature_flags(flag_key) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics events
CREATE TABLE analytics_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    anonymous_id UUID,
    entity_type VARCHAR(100),
    entity_id VARCHAR(100),
    source VARCHAR(50),
    device_id VARCHAR(100),
    metadata JSONB,
    occurred_at TIMESTAMP DEFAULT NOW(),
    received_at TIMESTAMP DEFAULT NOW()
);

-- Ingestion pipeline
CREATE TABLE ingestion_jobs (
    id BIGSERIAL PRIMARY KEY,
    source VARCHAR(100) NOT NULL,
    scope VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending', -- pending, running, succeeded, failed
    stats JSONB,
    started_at TIMESTAMP DEFAULT NOW(),
    finished_at TIMESTAMP
);

CREATE TABLE ingested_deal_raw (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    merchant_alias VARCHAR(255),
    raw_payload JSONB NOT NULL,
    normalized_payload JSONB,
    status VARCHAR(20) DEFAULT 'pending', -- pending, matched, rejected
    matched_merchant_id INTEGER REFERENCES merchants(id) ON DELETE SET NULL,
    confidence NUMERIC(5,2),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE ingestion_errors (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT REFERENCES ingestion_jobs(id) ON DELETE CASCADE,
    stage VARCHAR(50),
    error_message TEXT,
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_deals_merchant_id ON deals(merchant_id);
CREATE INDEX idx_deals_category ON deals(category);
-- Location index will be created after merchants table is populated
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX idx_user_deal_interactions_user_id ON user_deal_interactions(user_id);
CREATE INDEX idx_user_deal_interactions_deal_id ON user_deal_interactions(deal_id);
CREATE INDEX idx_location_notifications_user_id ON location_notifications(user_id);
CREATE INDEX idx_feature_flag_overrides_flag_user ON feature_flag_overrides(flag_key, user_id);
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_occurred_at ON analytics_events(occurred_at);
CREATE INDEX idx_merchants_level ON merchants(level);
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_merchant_locations_merchant_id ON merchant_locations(merchant_id);
CREATE INDEX idx_deals_status ON deals(status);
CREATE INDEX idx_deals_visibility ON deals(visibility);
CREATE INDEX idx_deal_sources_deal_id ON deal_sources(deal_id);
CREATE INDEX idx_ingestion_jobs_status ON ingestion_jobs(status);
CREATE INDEX idx_ingested_deal_raw_job_id ON ingested_deal_raw(job_id);
