-- Remove legacy BRIEF state: update to WELCOME (pre-results intake phase)
-- conversation_state normalized table
UPDATE conversation_state SET state = 'WELCOME' WHERE state = 'BRIEF';
UPDATE conversation_state SET resume_view = 'WELCOME' WHERE resume_view = 'BRIEF';

-- conversations JSONB
UPDATE conversations
SET conversation_context = jsonb_set(conversation_context, '{state}', '"WELCOME"')
WHERE conversation_context->>'state' = 'BRIEF';
