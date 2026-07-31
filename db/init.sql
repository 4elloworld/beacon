REATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  house_number VARCHAR(20),
  street VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  concealed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  report_type VARCHAR(50),
  date_range_start DATE,
  date_range_end DATE,
  row_count INTEGER,
  owner_context TEXT,
  upload_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID REFERENCES uploads(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  date DATE,
  description TEXT,
  amount_in DECIMAL(12,2) DEFAULT 0,
  amount_out DECIMAL(12,2) DEFAULT 0,
  category VARCHAR(100),
  vendor_name VARCHAR(255),
  raw_row JSONB
);

CREATE TABLE flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id),
  flag_type VARCHAR(50),
  severity VARCHAR(20),
  title TEXT,
  detail TEXT,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE cost_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES portfolios(id) ON DELETE CASCADE,
  cost_type VARCHAR(50),
  mode VARCHAR(20),
  annual_amount DECIMAL(12,2),
  is_estimate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, cost_type)
);

CREATE TABLE concealment_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  concealed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE vote_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  selected_features TEXT[],
  other_feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_upload ON transactions(upload_id);
CREATE INDEX idx_transactions_property ON transactions(property_id);
CREATE INDEX idx_flags_portfolio ON flags(portfolio_id);
CREATE INDEX idx_flags_dismissed ON flags(dismissed_at) WHERE dismissed_at IS NULL;
