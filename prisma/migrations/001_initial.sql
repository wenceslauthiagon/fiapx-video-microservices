CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);

-- Video Jobs table
CREATE TABLE video_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_file_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'PENDING',
  progress INTEGER DEFAULT 0,
  input_path TEXT NOT NULL,
  output_path TEXT,
  frame_count INTEGER,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  finished_at TIMESTAMP
);

CREATE INDEX idx_video_jobs_user_id ON video_jobs(user_id);
CREATE INDEX idx_video_jobs_status ON video_jobs(status);

-- Notifications table
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_job_id ON notifications(job_id);
CREATE INDEX idx_notifications_sent ON notifications(sent);
