export interface GroqClientOptions {
  apiKey?: string;
  model?: string;
  endpoint?: string;
}

interface GroqChatMessage {
  role: "system" | "user";
  content: string;
}

interface GroqChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class GroqClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly endpoint: string;

  constructor(options: GroqClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GROQ_API_KEY ?? "";
    this.model = options.model ?? process.env.GROQ_MODEL ?? "llama-3.1-70b-versatile";
    this.endpoint = options.endpoint ?? "https://api.groq.com/openai/v1/chat/completions";
  }

  async completeChat(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }

    const messages: GroqChatMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ];

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GroqChatResponse;
    return data.choices?.[0]?.message?.content ?? "No response from model.";
  }
}
