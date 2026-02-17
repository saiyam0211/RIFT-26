-- Volunteer admins: city-scoped admins who can view volunteers, check-ins, and seat data for their city
CREATE TABLE IF NOT EXISTS volunteer_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    city VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_admins_email ON volunteer_admins(email);
CREATE INDEX IF NOT EXISTS idx_volunteer_admins_city ON volunteer_admins(city);
