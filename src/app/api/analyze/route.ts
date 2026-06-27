import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { imageData } = await req.json();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageData } },
        { type: "text", text: "この写真に写っているスペースを見て、収納・配置の改善提案を3つ、日本語の箇条書きで返してください。余計な説明は不要です。" }
      ]
    }]
  });
  const text = (response.content[0] as { type: string; text: string }).text;
  const suggestions = text
    .split("\n")
    .filter((line) => line.trim().startsWith("・") || line.trim().startsWith("-") || line.trim().match(/^\d+\./))
    .map((line) => line.replace(/^[-・\d.]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
  return NextResponse.json({ suggestions });
}
