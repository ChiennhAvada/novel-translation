const VI_PROMPT = `Bạn là một công cụ viết lại truyện tiểu thuyết tiếng Việt để người đọc bình thường có thể hiểu dễ dàng.

Đây là truyện dịch từ tiếng Trung nên thường có nhiều từ Hán Việt khó hiểu, câu văn lủng củng, ngữ pháp sai. Nhiệm vụ của bạn là viết lại cho tự nhiên, dễ đọc như người Việt nói chuyện hàng ngày.

Quy tắc BẮT BUỘC:
- Viết câu rõ ràng, đúng ngữ pháp tiếng Việt hiện đại, ngôn ngữ tự nhiên
- Giữ nguyên TOÀN BỘ nội dung, cốt truyện, hội thoại - KHÔNG được cắt bỏ hay thêm bất kỳ chi tiết nào
- Giữ nguyên tên riêng nhân vật và địa danh
- Những từ chửi bậy cứ viết thoải mái sao cho đúng ngữ cảnh nhất có thể
- Dùng từ ta thay cho tôi; dùng từ huynh, đệ, muội, tỷ
- Chỉ trả về văn bản đã viết lại, không giải thích gì thêm`;

const ZH_PROMPT = `Bạn là một dịch giả chuyên nghiệp, dịch truyện tiểu thuyết từ tiếng Trung sang tiếng Việt.

Quy tắc BẮT BUỘC:
- Dịch TOÀN BỘ nội dung sang tiếng Việt tự nhiên, dễ đọc
- Giữ nguyên TOÀN BỘ nội dung, cốt truyện, hội thoại - KHÔNG được cắt bỏ hay thêm bất kỳ chi tiết nào
- Tên riêng nhân vật và địa danh: phiên âm Hán Việt
- Viết câu rõ ràng, đúng ngữ pháp tiếng Việt hiện đại
- Những từ chửi bậy cứ dịch thoải mái sao cho đúng ngữ cảnh nhất có thể
- Dùng từ ta thay cho tôi; dùng từ huynh, đệ, muội, tỷ
- Chỉ trả về bản dịch, không giải thích gì thêm`;

const LINE_BREAK_INSTRUCTION = `
- Tự động ngắt đoạn văn hợp lý: thêm dòng trống giữa các đoạn khi chuyển cảnh, chuyển ý, hoặc chuyển lời thoại. KHÔNG ngắt dòng mỗi câu.`;

function getSystemPrompt(lang: string, autoLineBreak: boolean): string {
  const base = lang === "zh" ? ZH_PROMPT : VI_PROMPT;
  return autoLineBreak ? base + LINE_BREAK_INSTRUCTION : base;
}

function getProvider(model: string): "openai" | "gemini" | "claude" {
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("claude")) return "claude";
  return "openai";
}

async function streamOpenAI(apiKey: string, model: string, text: string, systemPrompt: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      stream_options: { include_usage: true },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `OpenAI error: ${res.status}`);
  }

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let usage = { input: 0, output: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
            if (json.usage) {
              usage.input = json.usage.prompt_tokens || 0;
              usage.output = json.usage.completion_tokens || 0;
            }
          } catch {
            // skip
          }
        }
      }
      controller.enqueue(encoder.encode(`\n<!--USAGE:${JSON.stringify(usage)}-->`));
      controller.close();
    },
  });
}

async function streamGemini(apiKey: string, model: string, text: string, systemPrompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text }] }],
      generationConfig: { temperature: 0.3 },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Gemini error: ${res.status}`);
  }

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let usage = { input: 0, output: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            const parts = json.candidates?.[0]?.content?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.text) controller.enqueue(encoder.encode(part.text));
              }
            }
            if (json.usageMetadata) {
              usage.input = json.usageMetadata.promptTokenCount || 0;
              usage.output = json.usageMetadata.candidatesTokenCount || 0;
            }
          } catch {
            // skip
          }
        }
      }
      controller.enqueue(encoder.encode(`\n<!--USAGE:${JSON.stringify(usage)}-->`));
      controller.close();
    },
  });
}

async function streamClaude(apiKey: string, model: string, text: string, systemPrompt: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: text }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Claude error: ${res.status}`);
  }

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let usage = { input: 0, output: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.type === "content_block_delta" && json.delta?.text) {
              controller.enqueue(encoder.encode(json.delta.text));
            }
            if (json.type === "message_start" && json.message?.usage) {
              usage.input = json.message.usage.input_tokens || 0;
            }
            if (json.type === "message_delta" && json.usage) {
              usage.output = json.usage.output_tokens || 0;
            }
          } catch {
            // skip
          }
        }
      }
      controller.enqueue(encoder.encode(`\n<!--USAGE:${JSON.stringify(usage)}-->`));
      controller.close();
    },
  });
}

export async function POST(req: Request) {
  try {
    const { text, apiKey, model, lang, autoLineBreak } = await req.json();

    if (!text || typeof text !== "string") {
      return Response.json({ error: "Missing text" }, { status: 400 });
    }

    if (!apiKey || typeof apiKey !== "string") {
      return Response.json(
        { error: "API key is required. Set it in Settings." },
        { status: 400 }
      );
    }

    const provider = getProvider(model || "gpt-4o");
    const systemPrompt = getSystemPrompt(lang || "vi", !!autoLineBreak);
    let stream: ReadableStream;

    switch (provider) {
      case "gemini":
        stream = await streamGemini(apiKey, model, text, systemPrompt);
        break;
      case "claude":
        stream = await streamClaude(apiKey, model, text, systemPrompt);
        break;
      default:
        stream = await streamOpenAI(apiKey, model || "gpt-4o", text, systemPrompt);
        break;
    }

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
