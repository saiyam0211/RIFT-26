-- Create volunteers table
CREATE TABLE IF NOT EXISTS volunteers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('scanner', 'table')),
    counter_name VARCHAR(100),
    city VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_volunteers_email ON volunteers(email);
CREATE INDEX idx_volunteers_city ON volunteers(city);
CREATE INDEX idx_volunteers_role ON volunteers(role);

-- Create volunteer activity logs table
CREATE TABLE IF NOT EXISTS volunteer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID REFERENCES volunteers(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volunteer_logs_volunteer_id ON volunteer_logs(volunteer_id);
CREATE INDEX idx_volunteer_logs_created_at ON volunteer_logs(created_at DESC);
