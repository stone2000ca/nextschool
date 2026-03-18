// Replacement for legacy SDK.integrations.Core.InvokeLLM and legacy SDK.asServiceRole.integrations.Core.SendEmail
// These call OpenRouter for LLM and a mail service for email.

export interface InvokeLLMOptions {
  prompt: string
  response_json_schema?: Record<string, any>
  model?: string
}

/**
 * Calls OpenRouter LLM API — replaces legacy SDK.integrations.Core.InvokeLLM
 */
export async function invokeLLM(options: InvokeLLMOptions): Promise<any> {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  const modelMap: Record<string, string> = {
    'gpt-5': 'openai/gpt-4.1',
    'gpt-4o': 'openai/gpt-4.1-mini',
  }
  const model = modelMap[options.model || ''] || 'openai/gpt-4.1-mini'

  const body: any = {
    model,
    messages: [{ role: 'user', content: options.prompt }],
    temperature: 0.5,
  }

  if (options.response_json_schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'response',
        schema: options.response_json_schema,
      },
    }
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nextschool.ca',
      'X-OpenRouter-Title': 'NextSchool',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LLM call failed (${response.status}): ${errText}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content?.trim()

  if (!content) return content

  // If we requested JSON, parse it
  if (options.response_json_schema) {
    try {
      return JSON.parse(content)
    } catch {
      return content
    }
  }

  return content
}

export interface SendEmailOptions {
  from_name: string
  to: string
  subject: string
  body: string
}

/**
 * Sends email — replaces legacy SDK.asServiceRole.integrations.Core.SendEmail
 * TODO: Wire up to your actual email provider (SendGrid, Resend, SES, etc.)
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  // Placeholder: integrate with your email provider
  // For now, log the email attempt
  console.log(`[sendEmail] To: ${options.to}, Subject: ${options.subject}`)

  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY
  if (SENDGRID_API_KEY) {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: process.env.FROM_EMAIL || 'noreply@nextschool.ca', name: options.from_name },
        subject: options.subject,
        content: [{ type: 'text/html', value: options.body }],
      }),
    })
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Email send failed (${response.status}): ${errText}`)
    }
    return
  }

  // If no email provider configured, warn but don't fail
  console.warn('[sendEmail] No email provider configured. Email not sent.')
}
