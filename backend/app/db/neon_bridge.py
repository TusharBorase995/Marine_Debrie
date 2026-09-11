import asyncio
import threading
import logging
import socket
import time
from urllib.parse import urlparse
import websockets

logger = logging.getLogger("neon_bridge")
logger.setLevel(logging.INFO)

_bridge_lock = threading.Lock()
_bridge_server = None
_bridge_port = None
_bridge_loop = None
_bridge_thread = None

def is_tcp_port_reachable(host: str, port: int, timeout: float = 2.0) -> bool:
    """Tests if a remote TCP host and port can be connected to directly."""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def find_free_port() -> int:
    """Finds an available local port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

async def _pipe_stream(reader, writer, ws_url: str):
    """Pipes raw PostgreSQL wire protocol stream between local TCP client and Neon WSS endpoint."""
    try:
        async with websockets.connect(
            ws_url,
            subprotocols=["binary"],
            ping_interval=20,
            ping_timeout=20,
            close_timeout=10,
            max_size=32 * 1024 * 1024
        ) as ws:
            async def tcp_to_ws():
                try:
                    while True:
                        data = await reader.read(65536)
                        if not data:
                            break
                        await ws.send(data)
                except Exception:
                    pass

            async def ws_to_tcp():
                try:
                    async for message in ws:
                        if isinstance(message, str):
                            writer.write(message.encode())
                        else:
                            writer.write(message)
                        await writer.drain()
                except Exception:
                    pass

            await asyncio.gather(tcp_to_ws(), ws_to_tcp())
    except Exception as e:
        logger.debug(f"Neon bridge stream ended: {e}")
    finally:
        try:
            writer.close()
            await writer.wait_closed()
        except Exception:
            pass

def ensure_neon_bridge(neon_host: str, target_port: int = 5432) -> int:
    """
    Ensures a background TCP-to-WebSocket bridge is running locally.
    Returns the local port number (e.g. 5433).
    """
    global _bridge_port, _bridge_server, _bridge_loop, _bridge_thread

    with _bridge_lock:
        if _bridge_port is not None:
            return _bridge_port

        local_port = find_free_port()
        ws_url = f"wss://{neon_host}/v1?address={neon_host}:{target_port}"
        ready_event = threading.Event()

        def run_loop():
            global _bridge_loop, _bridge_server
            _bridge_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(_bridge_loop)

            async def start_server():
                global _bridge_server
                server = await asyncio.start_server(
                    lambda r, w: _pipe_stream(r, w, ws_url),
                    '127.0.0.1',
                    local_port
                )
                _bridge_server = server
                ready_event.set()
                logger.info(f"Neon WSS bridge listening on 127.0.0.1:{local_port} -> {ws_url}")
                async with server:
                    await server.serve_forever()

            try:
                _bridge_loop.run_until_complete(start_server())
            except Exception as e:
                logger.error(f"Neon bridge loop terminated: {e}")
                ready_event.set()

        _bridge_thread = threading.Thread(target=run_loop, daemon=True, name="neon-wss-bridge")
        _bridge_thread.start()
        ready_event.wait(timeout=5.0)
        _bridge_port = local_port
        return _bridge_port
