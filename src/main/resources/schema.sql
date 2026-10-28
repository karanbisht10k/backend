-- ==========================================================
-- CodeSense & DevPilot Database Schema
-- Compatible with PostgreSQL 14+ / PGVector
-- ==========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    github_id BIGINT UNIQUE NOT NULL,
    github_username VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    avatar_url VARCHAR(500),
    access_token TEXT NOT NULL,
    token_scopes VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repositories (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    github_repo_id BIGINT NOT NULL,
    owner VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    full_name VARCHAR(300) NOT NULL,
    is_private BOOLEAN NOT NULL DEFAULT FALSE,
    default_branch VARCHAR(100) NOT NULL DEFAULT 'main',
    commit_sha VARCHAR(100),
    language VARCHAR(100),
    html_url VARCHAR(500),
    description TEXT,
    index_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    indexed_at TIMESTAMP WITH TIME ZONE,
    chunk_count INT NOT NULL DEFAULT 0,
    files_total INT NOT NULL DEFAULT 0,
    files_processed INT NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_user_github_repo UNIQUE (user_id, github_repo_id)
);

CREATE INDEX IF NOT EXISTS idx_repos_user_id ON repositories(user_id);

CREATE TABLE IF NOT EXISTS code_structures (
    id UUID PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    commit_sha VARCHAR(100),
    file_path VARCHAR(500) NOT NULL,
    language VARCHAR(50),
    package_name VARCHAR(300),
    is_test BOOLEAN NOT NULL DEFAULT FALSE,
    line_count INT NOT NULL DEFAULT 0,
    imports_json TEXT,
    symbols_json TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cs_repo ON code_structures(repository_id);
CREATE INDEX IF NOT EXISTS idx_cs_repo_file ON code_structures(repository_id, file_path);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_user_repo ON chat_sessions(user_id, repository_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    citations TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_msg_session ON chat_messages(session_id);

CREATE TABLE IF NOT EXISTS pull_request_analyses (
    id UUID PRIMARY KEY,
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pr_number INT NOT NULL,
    pr_url VARCHAR(500) NOT NULL,
    pr_title VARCHAR(500),
    base_sha VARCHAR(100),
    head_sha VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    overall_result VARCHAR(50),
    critical_count INT NOT NULL DEFAULT 0,
    high_count INT NOT NULL DEFAULT 0,
    medium_count INT NOT NULL DEFAULT 0,
    low_count INT NOT NULL DEFAULT 0,
    info_count INT NOT NULL DEFAULT 0,
    summary_text TEXT,
    limitations TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pra_repo ON pull_request_analyses(repository_id);
CREATE INDEX IF NOT EXISTS idx_pra_user ON pull_request_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_pra_repo_pr ON pull_request_analyses(repository_id, pr_number);

CREATE TABLE IF NOT EXISTS pr_findings (
    id UUID PRIMARY KEY,
    analysis_id UUID NOT NULL REFERENCES pull_request_analyses(id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    category VARCHAR(35) NOT NULL,
    title VARCHAR(300) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    start_line INT,
    end_line INT,
    description TEXT NOT NULL,
    evidence TEXT,
    impact TEXT,
    suggested_fix TEXT,
    recommended_test TEXT,
    confidence VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prf_analysis ON pr_findings(analysis_id);
CREATE INDEX IF NOT EXISTS idx_prf_severity ON pr_findings(severity);

CREATE TABLE IF NOT EXISTS pr_impact_reports (
    id UUID PRIMARY KEY,
    analysis_id UUID NOT NULL UNIQUE REFERENCES pull_request_analyses(id) ON DELETE CASCADE,
    impact_json TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
