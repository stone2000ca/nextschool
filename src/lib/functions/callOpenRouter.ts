// @ts-nocheck
// Function: callOpenRouter
// Purpose: Shared LLM caller with model waterfall, JSON schema support, timeout, and logging
// Entities: LLMLog
// Last Modified: 2026-03-18
// Dependencies: OpenRouter API
// E18c-002: LLM call logging — writes LLMLog entity for every call (fire-and-forget)
// E32-001: Added tools/toolChoice/returnRaw support

import { LLMLog } from '@/lib/entities-server'

export async function callOpenRouter(options) {
  // callOpenRouter v1.1 -- E32-001: added tools/toolChoice/returnRaw
  const { systemPrompt, userPrompt, prompt, responseSchema, response_json_schema, maxTokens = 1000, temperature = 0.5, _logContext, tools, toolChoice, returnRaw = false, model } = options;

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.warn('[OPENROUTER] OPENROUTER_API_KEY not set');
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const messages: Array<{role: string; content: string}> = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt || prompt || '' });

  // Model waterfall: WC-2 upgrade — Gemini 3 Flash Preview primary, GPT-4.1-mini fallback, Gemini Flash tertiary
  const models = ['google/gemini-3-flash-preview', 'openai/gpt-4.1-mini', 'google/gemini-2.5-flash'];

  const body: any = {
    models,
    messages,
    max_tokens: maxTokens,
    temperature
  };

  // E32-001: Inject tools when provided
  if (tools && tools.length > 0) {
    body.tools = tools;
    body.tool_choice = toolChoice || 'auto';
  }

  // Support both responseSchema and response_json_schema
  const schema = responseSchema || response_json_schema;
  if (schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: schema.name || 'response',
        strict: true,
        schema: schema.schema || schema
      }
    };
  }

  console.log('[OPENROUTER] Calling with models:', body.models, 'maxTokens:', maxTokens);

  // E18c-002: Start timer
  const startTime = Date.now();

  const fullPromptStr = messages.map(m => `[${m.role}] ${m.content}`).join('\n');

  const controller = new AbortController();
  const TIMEOUT_MS = 10000;
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://nextschool.ca',
        'X-OpenRouter-Title': 'NextSchool'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const latency_ms = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[OPENROUTER] API error:', response.status, errorText);

      // E18c-002: Log error (fire-and-forget)
      if (_logContext) {
        const isTest = _logContext.is_test === true;
        LLMLog.create({
          conversationId: _logContext.conversationId || 'unknown',
          phase: _logContext.phase || 'unknown',
          model: 'unknown',
          prompt_summary: fullPromptStr.substring(0, 500),
          response_summary: errorText.substring(0, 500),
          token_count_in: 0,
          token_count_out: 0,
          latency_ms,
          status: 'error',
          is_test: isTest,
          ...(isTest ? { full_prompt: fullPromptStr } : {}),
          error_message: `HTTP ${response.status}: ${errorText.substring(0, 300)}`
        }).catch(e => console.error('[E18c-002] LLMLog write failed:', e.message));
      }

      throw new Error(`OpenRouter API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[OPENROUTER] Response model used:', data.model, 'usage:', data.usage);

    const content = data.choices?.[0]?.message?.content;
    const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
    if (!content && toolCalls.length === 0) throw new Error('OpenRouter returned empty content');

    // E18c-002: Log success (fire-and-forget)
    if (_logContext) {
      const isTest = _logContext.is_test === true;
      LLMLog.create({
        conversationId: _logContext.conversationId || 'unknown',
        phase: _logContext.phase || 'unknown',
        model: data.model || 'unknown',
        prompt_summary: fullPromptStr.substring(0, 500),
        response_summary: (content || '').substring(0, 500),
        token_count_in: data.usage?.prompt_tokens || 0,
        token_count_out: data.usage?.completion_tokens || 0,
        latency_ms,
        status: 'success',
        is_test: isTest,
        ...(isTest ? { full_prompt: fullPromptStr, full_response: content } : {})
      }).catch(e => console.error('[E18c-002] LLMLog write failed:', e.message));
    }

    if (schema) {
      try {
        return JSON.parse(content);
      } catch (e) {
        console.error('[OPENROUTER] JSON parse failed:', content.substring(0, 200));
        throw new Error('OpenRouter structured output parse failed');
      }
    }

    // E32-001: returnRaw returns { content, toolCalls } for callers that need tool_calls
    if (returnRaw) return { content: content || '', toolCalls };

    return content;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      console.error(`[TIMEOUT] callOpenRouter timed out after ${TIMEOUT_MS}ms`);
      throw new Error(`LLM request timed out after ${TIMEOUT_MS/1000}s`);
    }
    console.error(`[callOpenRouter] Model call failed:`, err.message);
    const latency_ms = Date.now() - startTime;
    // Only log if not already logged above (i.e. network-level errors, not HTTP errors)
    const isNetworkError = !err.message?.startsWith('OpenRouter API error:') && err.message !== 'OpenRouter returned empty content' && err.message !== 'OpenRouter structured output parse failed';
    if (isNetworkError && _logContext) {
      const isTest = _logContext.is_test === true;
      LLMLog.create({
        conversationId: _logContext.conversationId || 'unknown',
        phase: _logContext.phase || 'unknown',
        model: 'unknown',
        prompt_summary: fullPromptStr.substring(0, 500),
        response_summary: '',
        token_count_in: 0,
        token_count_out: 0,
        latency_ms,
        status: 'timeout',
        is_test: isTest,
        ...(isTest ? { full_prompt: fullPromptStr } : {}),
        error_message: err.message?.substring(0, 300)
      }).catch(e => console.error('[E18c-002] LLMLog write failed:', e.message));
    }
    throw err;
  }
}
