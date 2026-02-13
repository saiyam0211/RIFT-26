-- Create tables table for managing physical tables at the event
CREATE TABLE IF NOT EXISTS event_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    table_number VARCHAR(20) UNIQUE NOT NULL,
    city VARCHAR(50) NOT NULL,
    capacity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_event_tables_city ON event_tables(city);
CREATE INDEX idx_event_tables_active ON event_tables(is_active);
