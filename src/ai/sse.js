export async function streamChat({ messages, context, signal, onEvent }) {
  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, context }),
    signal,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || `AI 请求失败（HTTP ${res.status}）`);
  }
  if (!res.body) throw new Error('浏览器不支持流式响应');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = chunk
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (dataLine) {
        const payload = dataLine.slice(6);
        if (payload === '[DONE]') return;
        try {
          onEvent(JSON.parse(payload));
        } catch {
          // 忽略无法解析的心跳或空行
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}
