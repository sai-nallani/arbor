"""
FastAPI Chat Server with UI
===========================
Full-stack chat application with model and MCP server selection.

Run: uv run --python 3.13 cookbook/02_chat_server.py
Then open: http://localhost:8000
"""

import asyncio
import json
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
import uvicorn

from dedalus_labs import AsyncDedalus, DedalusRunner

load_dotenv()

# In-memory session storage (use Redis/DB in production)
sessions: dict[str, list[dict]] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "=" * 50)
    print("  Dedalus Chat Server")
    print("  Open http://localhost:8000")
    print("=" * 50 + "\n")
    yield


app = FastAPI(lifespan=lifespan)


HTML_PAGE = """
<!DOCTYPE html>
<html>
<head>
    <title>Dedalus Chat</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #fff; color: #111; height: 100vh;
            display: flex; flex-direction: column;
        }
        .header {
            padding: 12px 24px;
            border-bottom: 1px solid #e5e5e5;
            display: flex; gap: 24px; align-items: center;
        }
        .header h1 { font-size: 16px; font-weight: 600; margin-right: auto; }
        .header select, .header input {
            padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d1d1;
            background: #fff; color: #111; font-size: 13px;
        }
        .header select:focus, .header input:focus { outline: none; border-color: #111; }
        .config { display: flex; align-items: center; gap: 8px; }
        .config label { font-size: 12px; color: #666; }

        .chat-container {
            flex: 1; overflow-y: auto; padding: 24px;
            max-width: 800px; margin: 0 auto; width: 100%;
        }
        .message { margin-bottom: 24px; line-height: 1.6; }
        .message .role { font-size: 12px; font-weight: 600; margin-bottom: 4px; text-transform: uppercase; color: #666; }
        .message .content { white-space: pre-wrap; }
        .message.user .role { color: #111; }
        .message.assistant .content { color: #333; }
        .message.system { text-align: center; color: #999; font-size: 13px; }

        .input-container {
            padding: 16px 24px; border-top: 1px solid #e5e5e5;
            max-width: 800px; margin: 0 auto; width: 100%;
            display: flex; gap: 12px;
        }
        .input-container input {
            flex: 1; padding: 12px 16px; border-radius: 8px;
            border: 1px solid #d1d1d1; font-size: 15px;
        }
        .input-container input:focus { outline: none; border-color: #111; }
        .input-container button {
            padding: 12px 24px; border-radius: 8px; border: 1px solid #111;
            background: #111; color: #fff; font-size: 14px;
            cursor: pointer; font-weight: 500;
        }
        .input-container button:hover { background: #333; }
        .input-container button:disabled { background: #999; border-color: #999; cursor: not-allowed; }
        .typing .content::after { content: '...'; animation: dots 1s infinite; }
        @keyframes dots { 0%,20%{content:'.'} 40%{content:'..'} 60%,100%{content:'...'} }
    </style>
</head>
<body>
    <div class="header">
        <h1>Dedalus</h1>
        <div class="config">
            <label>Model</label>
            <select id="model">
                <option value="openai/gpt-5.1">GPT-5.1</option>
                <option value="anthropic/claude-opus-4-5-20251101">Opus 4.5</option>
                <option value="google/gemini-3-pro-preview">Gemini 3</option>
                <option value="openai/o4-mini-deep-research">O4 Mini Deep Research</option>
            </select>
        </div>
        <div class="config">
            <label>MCP</label>
            <input type="text" id="mcp" placeholder="server slug or URL" style="width:200px">
        </div>
    </div>

    <div class="chat-container" id="chat"></div>

    <div class="input-container">
        <input type="text" id="input" placeholder="Message..." autofocus>
        <button id="send">Send</button>
    </div>

    <script>
        const chat = document.getElementById('chat');
        const input = document.getElementById('input');
        const sendBtn = document.getElementById('send');
        const modelSelect = document.getElementById('model');
        const mcpInput = document.getElementById('mcp');

        let ws = null;
        let sessionId = 'session_' + Date.now();

        function connect() {
            ws = new WebSocket(`ws://${location.host}/ws/${sessionId}`);

            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);

                if (data.type === 'start') {
                    const msg = document.createElement('div');
                    msg.className = 'message assistant typing';
                    msg.id = 'typing';
                    msg.innerHTML = '<div class="role">Assistant</div><div class="content"></div>';
                    chat.appendChild(msg);
                } else if (data.type === 'chunk') {
                    const typing = document.getElementById('typing');
                    if (typing) {
                        typing.classList.remove('typing');
                        typing.querySelector('.content').textContent += data.content;
                    }
                } else if (data.type === 'done') {
                    const typing = document.getElementById('typing');
                    if (typing) typing.removeAttribute('id');
                    sendBtn.disabled = false;
                    input.focus();
                } else if (data.type === 'error') {
                    addMessage('Error: ' + data.message, 'system');
                    sendBtn.disabled = false;
                }
                chat.scrollTop = chat.scrollHeight;
            };

            ws.onclose = () => setTimeout(connect, 1000);
        }

        function addMessage(text, role) {
            const msg = document.createElement('div');
            msg.className = `message ${role}`;
            if (role === 'system') {
                msg.textContent = text;
            } else {
                msg.innerHTML = `<div class="role">${role === 'user' ? 'You' : 'Assistant'}</div><div class="content">${text}</div>`;
            }
            chat.appendChild(msg);
            chat.scrollTop = chat.scrollHeight;
        }

        function send() {
            const text = input.value.trim();
            if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

            addMessage(text, 'user');
            input.value = '';
            sendBtn.disabled = true;

            ws.send(JSON.stringify({
                message: text,
                model: modelSelect.value,
                mcp_servers: mcpInput.value ? [mcpInput.value] : []
            }));
        }

        sendBtn.onclick = send;
        input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
        connect();
    </script>
</body>
</html>
"""


@app.get("/")
async def get_ui():
    return HTMLResponse(HTML_PAGE)


@app.websocket("/ws/{session_id}")
async def websocket_chat(websocket: WebSocket, session_id: str):
    await websocket.accept()

    if session_id not in sessions:
        sessions[session_id] = []

    client = AsyncDedalus()
    runner = DedalusRunner(client)

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "")
            model = data.get("model", "openai/gpt-5.1")
            mcp_servers = data.get("mcp_servers", [])

            await websocket.send_json({"type": "start"})

            try:
                # Append user message to history first
                sessions[session_id].append({"role": "user", "content": message})
                history = sessions[session_id]

                kwargs = {
                    "messages": history,
                    "model": model,
                    "stream": True,
                }
                if mcp_servers:
                    kwargs["mcp_servers"] = mcp_servers

                response_stream = runner.run(**kwargs)

                full_response = ""
                async for chunk in response_stream:
                    if hasattr(chunk, "choices") and chunk.choices:
                        delta = chunk.choices[0].delta
                        if hasattr(delta, "content") and delta.content:
                            full_response += delta.content
                            await websocket.send_json({
                                "type": "chunk",
                                "content": delta.content
                            })

                # Save assistant response to session
                sessions[session_id].append({"role": "assistant", "content": full_response})

                await websocket.send_json({"type": "done"})

            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})

    except WebSocketDisconnect:
        pass


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)