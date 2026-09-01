/**
 * Helpers for article builder API routes: outline and article generation via OpenAI.
 * Returns mock data when OPENAI_API_KEY is not set so the UI still works.
 */

const DEFAULT_MODEL = "gpt-5.4-nano";

export async function chatJson<T>(system: string, user: string, model = DEFAULT_MODEL): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not set");
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as T;
}

/**
 * Like chatJson but streams tokens via SSE.
 * Returns a ReadableStream emitting:
 *   data: {"chunk":"text"}\n\n  — for each token
 *   data: {"done":true,...payload}\n\n — final parsed result + any extras
 *   data: {"error":"msg"}\n\n — on failure
 */
export function chatJsonStream(
  system: string,
  user: string,
  model: string,
  onComplete: (accumulated: string) => Promise<Record<string, unknown>>
): ReadableStream<Uint8Array> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const encoder = new TextEncoder();

  function send(controller: ReadableStreamDefaultController<Uint8Array>, obj: Record<string, unknown>) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
  }

  return new ReadableStream({
    async start(controller) {
      if (!apiKey) {
        send(controller, { error: "OPENAI_API_KEY not set" });
        controller.close();
        return;
      }

      let openaiRes: Response;
      try {
        openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            response_format: { type: "json_object" },
            stream: true,
          }),
        });
      } catch (e) {
        send(controller, { error: String(e) });
        controller.close();
        return;
      }

      if (!openaiRes.ok) {
        const t = await openaiRes.text();
        send(controller, { error: `OpenAI ${openaiRes.status}: ${t.slice(0, 200)}` });
        controller.close();
        return;
      }

      const reader = openaiRes.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const chunk = JSON.parse(line.slice(6)) as { choices?: { delta?: { content?: string } }[] };
            const text = chunk.choices?.[0]?.delta?.content ?? "";
            if (text) {
              accumulated += text;
              send(controller, { chunk: text });
            }
          } catch { /* malformed chunk — skip */ }
        }
      }

      try {
        const payload = await onComplete(accumulated);
        send(controller, { done: true, ...payload });
      } catch (e) {
        send(controller, { error: `Parse failed: ${String(e)}` });
      }
      controller.close();
    },
  });
}
