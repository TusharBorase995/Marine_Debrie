import asyncio
from datetime import datetime, timezone
from typing import List, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from mock_data import db_mock

router = APIRouter(tags=["WebSocket Live Feed"])

class WebSocketConnectionManager:
    """Manages active WebSocket connections for real-time ML detection streaming."""

    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WebSocket] Client connected. Total active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        print(f"[WebSocket] Client disconnected. Total active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcasts structured payload to all connected clients."""
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for dead_conn in disconnected:
            self.active_connections.discard(dead_conn)

ws_manager = WebSocketConnectionManager()

@router.websocket("/ws/live-feed")
async def live_feed_endpoint(websocket: WebSocket):
    """
    WS /ws/live-feed — Real-time stream of incoming ML sonar detections.
    Subscribers receive real-time detection broadcasts whenever new detections are ingested or reviewed.
    """
    await ws_manager.connect(websocket)
    await websocket.send_json({
        "type": "CONNECTION_ESTABLISHED",
        "message": "Connected to PS 26057 Real-Time ML Detection Stream"
    })
    try:
        while True:
            # Heartbeat loop every 30s to keep WebSocket connection alive
            await asyncio.sleep(30.0)
            await websocket.send_json({
                "type": "HEARTBEAT",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        print(f"[WebSocket Error] {e}")
        ws_manager.disconnect(websocket)
