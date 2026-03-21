const VI_PROMPT = `Bạn là biên tập viên chuyên viết lại truyện tiên hiệp/kiếm hiệp tiếng Việt (dịch từ tiếng Trung). Văn gốc thường lủng củng, ngữ pháp sai, từ ngữ khó hiểu. Nhiệm vụ của bạn là viết lại cho mượt mà, đúng văn phong cổ phong nhưng vẫn dễ đọc.

Quy tắc BẮT BUỘC:

NỘI DUNG:
- Giữ nguyên TOÀN BỘ nội dung, cốt truyện, hội thoại - KHÔNG được cắt bỏ hay thêm bất kỳ chi tiết nào
- Giữ nguyên tên riêng nhân vật và địa danh
- Những từ chửi bậy cứ viết thoải mái sao cho đúng ngữ cảnh nhất có thể

VĂN PHONG:
- Sử dụng ngôn ngữ trang trọng, cổ phong, mang âm hưởng kiếm hiệp/tiên hiệp. Tránh dùng từ ngữ hiện đại hoặc quá bình dân
- Câu văn cần có nhịp điệu, mượt mà, dịch thoát ý - không được dịch word-by-word kiểu máy móc
- Viết câu đúng ngữ pháp tiếng Việt, rõ ràng dễ hiểu

ĐẠI TỪ NHÂN XƯNG (quan trọng):
- KHÔNG dùng "Tôi - Bạn" hay "Anh - Em" trừ bối cảnh hiện đại đặc biệt
- Xưng hô phải linh hoạt theo vai vế và địa vị: Ta - Ngươi (ngang hàng), Lão phu - Tiểu hữu (bậc trên - dưới), Bản tọa - Các ngươi (chưởng môn), Sư tôn - Đệ tử, Phụ thân/Cha - Con
- Cha nói với con: xưng "Ta" gọi "con". Con nói với cha: xưng "Con" gọi "cha/phụ thân"
- Đồng môn/giang hồ: dùng huynh, đệ, muội, tỷ
- Chúng tôi -> Bọn ta / Chúng ta
- Ngôi thứ 3 kể chuyện: Anh ấy -> Hắn, Cô ấy -> Nàng/Bà (tùy ngữ cảnh)

THUẬT NGỮ:
- Ưu tiên từ Hán Việt cho danh từ riêng, chiêu thức, pháp bảo, địa danh, thuật ngữ tu luyện (VD: "Trúc Cơ", "Kim Đan", "Phi Kiếm", "Tông môn")
- Giữ nguyên cấp bậc tu luyện chuẩn: Luyện Khí, Trúc Cơ, Kết Đan, Nguyên Anh, Hóa Thần, Luyện Hư, Hợp Thể, Đại Thừa, Độ Kiếp
- Nhất quán: một thuật ngữ/tên phải dịch giống nhau xuyên suốt (không đổi qua lại giữa các cách dịch khác nhau)

HỘI THOẠI:
- Lời thoại đặt trong dấu ngoặc kép "..."
- Mỗi lượt thoại của nhân vật khác nhau xuống dòng mới

- Chỉ trả về văn bản đã viết lại, không giải thích gì thêm`;

const ZH_PROMPT = `Bạn là dịch giả chuyên nghiệp, chuyên dịch truyện tiên hiệp/kiếm hiệp từ tiếng Trung sang tiếng Việt theo văn phong cổ phong.

Quy tắc BẮT BUỘC:

NỘI DUNG (quan trọng):
- Dịch TOÀN BỘ nội dung - KHÔNG được cắt bỏ hay thêm bất kỳ chi tiết nào
- KHÔNG được để lại bất kỳ chữ Trung Quốc (汉字) nào. Tất cả phải được dịch hoặc phiên âm Hán Việt
- Tên riêng nhân vật và địa danh: phiên âm Hán Việt
- Những từ chửi bậy cứ dịch thoải mái sao cho đúng ngữ cảnh nhất có thể

VĂN PHONG:
- Sử dụng ngôn ngữ trang trọng, cổ phong, mang âm hưởng kiếm hiệp/tiên hiệp. Tránh dùng từ ngữ hiện đại hoặc quá bình dân
- Câu văn cần có nhịp điệu, mượt mà, dịch thoát ý - không được dịch word-by-word kiểu máy móc
- Viết câu đúng ngữ pháp tiếng Việt, rõ ràng dễ hiểu

ĐẠI TỪ NHÂN XƯNG (quan trọng):
- KHÔNG dùng "Tôi - Bạn" hay "Anh - Em" trừ bối cảnh hiện đại đặc biệt
- Xưng hô phải linh hoạt theo vai vế và địa vị: Ta - Ngươi (ngang hàng), Lão phu - Tiểu hữu (bậc trên - dưới), Bản tọa - Các ngươi (chưởng môn), Sư tôn - Đệ tử, Phụ thân/Cha - Con
- Đồng môn/giang hồ: dùng huynh, đệ, muội, tỷ
- Chúng tôi -> Bọn ta / Chúng ta
- Ngôi thứ 3 kể chuyện: Anh ấy -> Hắn, Cô ấy -> Nàng/Bà (tùy ngữ cảnh)

THUẬT NGỮ:
- Ưu tiên từ Hán Việt cho danh từ riêng, chiêu thức, pháp bảo, địa danh, thuật ngữ tu luyện (VD: "Trúc Cơ", "Kim Đan", "Phi Kiếm", "Tông môn")
- Giữ nguyên cấp bậc tu luyện chuẩn: Luyện Khí, Trúc Cơ, Kết Đan, Nguyên Anh,...
- Nhất quán: một thuật ngữ/tên phải dịch giống nhau xuyên suốt (không đổi qua lại giữa các cách dịch khác nhau)

HỘI THOẠI:
- Lời thoại đặt trong dấu ngoặc kép "..."
- Mỗi lượt thoại của nhân vật khác nhau xuống dòng mới

- Chỉ trả về bản dịch, không giải thích gì thêm`;

const LINE_BREAK_INSTRUCTION = `
- Tự động ngắt đoạn văn hợp lý: thêm dòng trống giữa các đoạn khi chuyển cảnh, chuyển ý, hoặc chuyển lời thoại. KHÔNG ngắt dòng mỗi câu.`;

function getSystemPrompt(lang: string, autoLineBreak: boolean): string {
  const base = lang === "zh" ? ZH_PROMPT : VI_PROMPT;
  return autoLineBreak ? base + LINE_BREAK_INSTRUCTION : base;
}

function getProvider(model: string): "openai" | "gemini" | "claude" | "openrouter" {
  if (model.startsWith("gemini")) return "gemini";
  if (model.startsWith("claude")) return "claude";
  if (model.includes("/")) return "openrouter";
  return "openai";
}

async function streamOpenAI(apiKey: string, model: string, text: string, systemPrompt: string, baseUrl = "https://api.openai.com/v1") {
  const res = await fetch(`${baseUrl}/chat/completions`, {
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
    const { text, apiKey, model, lang, autoLineBreak, customPrompt } = await req.json();

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
    let systemPrompt = getSystemPrompt(lang || "vi", !!autoLineBreak);
    if (customPrompt && typeof customPrompt === "string") {
      systemPrompt += "\n" + customPrompt.trim();
    }
    let stream: ReadableStream;

    switch (provider) {
      case "gemini":
        stream = await streamGemini(apiKey, model, text, systemPrompt);
        break;
      case "claude":
        stream = await streamClaude(apiKey, model, text, systemPrompt);
        break;
      case "openrouter":
        stream = await streamOpenAI(apiKey, model, text, systemPrompt, "https://openrouter.ai/api/v1");
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
