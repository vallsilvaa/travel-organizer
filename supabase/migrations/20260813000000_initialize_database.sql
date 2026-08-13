-- Establishes a versioned migration baseline for the Travel Organizer database.
-- Domain tables and Row Level Security policies will be added with their features.
create extension if not exists pgcrypto with schema extensions;
