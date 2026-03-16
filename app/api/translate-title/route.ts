function getProvider(model: string): "openai" | "gemini" | "claude" {
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("claude")) return "claude";
  return "openai";
}

const DEFAULT_PROMPT = "Dịch tiêu đề truyện sau từ tiếng Trung sang phiên âm Hán Việt. KHÔNG được để lại bất kỳ chữ Trung Quốc nào. Chỉ trả về bản dịch, không giải thích.";

async function translate(apiKey: string, model: string, title: string, prompt: string): Promise<string> {
  const provider = getProvider(model);

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: prompt }] },
        contents: [{ parts: [{ text: title }] }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!res.ok) return title;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || title;
  }

  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        system: prompt,
        messages: [{ role: "user", content: title }],
        temperature: 0.1,
      }),
    });
    if (!res.ok) return title;
    const data = await res.json();
    return data.content?.[0]?.text?.trim() || title;
  }

  // OpenAI
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o",
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: title },
      ],
      temperature: 0.1,
    }),
  });
  if (!res.ok) return title;
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || title;
}

export async function POST(req: Request) {
  try {
    const { title, apiKey, model, prompt } = await req.json();

    if (!title || !apiKey) {
      return Response.json({ translated: title }, { status: 200 });
    }

    const translated = await translate(apiKey, model || "gpt-4o", title, prompt || DEFAULT_PROMPT);
    return Response.json({ translated });
  } catch {
    return Response.json({ translated: "" }, { status: 200 });
  }
}
