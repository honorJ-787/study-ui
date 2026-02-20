import { useMemo, useState } from "react"
import { Chat } from "@/components/ui/chat"

type UIMessage = { id: string; role: "user" | "assistant"; content: string }

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE?.trim?.() || "http://127.0.0.1:8001"

function renderAgentReply(res: any): string {
  const mode = res?.mode
  const d = res?.data

  if (mode === "ask") return d?.answer ?? JSON.stringify(res, null, 2)

  if (mode === "dashboard") {
    return `📌 今日复习：${d?.due_count ?? 0} 个到期
✅ 今日已做：${d?.done_today ?? 0}
⏱ 建议时长：${d?.suggested_minutes ?? 0} 分钟

薄弱标签：
${
      (d?.weak_tags_30d || [])
        .map((x: any) => `- ${x.tag}: ${(x.wrong_rate * 100).toFixed(0)}% (${x.wrong}/${x.total})`)
        .join("\n") || "（暂无）"
    }

最近错题：
${
      (d?.recent_mistakes || [])
        .slice(0, 5)
        .map((m: any) => `- [${m.tag}] ${m.prompt}`)
        .join("\n") || "（暂无）"
    }`
  }

  if (mode === "study_start") {
    const q = d?.question
    const opts = (q?.options || [])
      .map((x: string, i: number) => `${"ABCD"[i]}. ${x}`)
      .join("\n")
    return `📝 开始刷题（${d?.bucket ?? ""}）

${q?.prompt ?? ""}

${opts || ""}

（直接回复 A/B/C/D 或 “正确/错误” 或简答）`
  }

  if (mode === "study_answer") {
    const g = d?.graded
    const q = d?.next?.question
    const opts = (q?.options || [])
      .map((x: string, i: number) => `${"ABCD"[i]}. ${x}`)
      .join("\n")

    return `✅ 批改：${g?.feedback ?? ""}
⏰ 下次复习：${g?.due_utc ?? ""}
📎 参考答案：${g?.reference_answer ?? ""}

➡️ 下一题（${d?.next?.bucket ?? ""}）

${q?.prompt ?? ""}

${opts || ""}`
  }

  return JSON.stringify(res, null, 2)
}

async function callChat(text: string) {
  const r = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "u1", message: text, use_web: true }),
  })
  const data = await r.json()
  return { raw: data, text: renderAgentReply(data) }
}

export default function App() {
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)

  const stop = () => setIsGenerating(false)

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e?: any) => {
    e?.preventDefault?.()

    const text = input.trim()
    if (!text || isGenerating) return

    console.log("[ui] submit:", text, "API_BASE =", API_BASE)

    const userMsg: UIMessage = { id: crypto.randomUUID(), role: "user", content: text }
    setMessages((m) => [...m, userMsg])
    setInput("")
    setIsGenerating(true)

    try {
      const { raw, text: assistantText } = await callChat(text)
      console.log("[api] /chat response:", raw)

      const aiMsg: UIMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: assistantText,
      }
      setMessages((m) => [...m, aiMsg])
    } catch (err) {
      console.error(err)
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", content: `请求失败：${String(err)}` },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const chatMessages = useMemo(
    () => messages.map((m) => ({ id: m.id, role: m.role, content: m.content })),
    [messages]
  )

  return (
    <div className="min-h-svh">
      <Chat
        messages={chatMessages as any}
        input={input}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit as any}
        isGenerating={isGenerating}
        stop={stop}
        suggestions={[
          "今天复习计划",
          "开始刷题 5题 主题刑法 冷门1题 新题2题",
          "总结最近一周财政政策重点，并给出权威引用",
        ]}
        setMessages={setMessages as any}
      />
    </div>
  )
}