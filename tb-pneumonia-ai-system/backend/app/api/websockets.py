from fastapi import WebSocket
from typing import List


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[dict] = []

    async def connect(self, websocket: WebSocket, doctor_id: int = None, request_id: int = None):
        await websocket.accept()
        self.active_connections.append(
            {"websocket": websocket, "doctor_id": doctor_id, "request_id": request_id}
        )

    def disconnect(self, websocket: WebSocket):
        self.active_connections = [
            entry for entry in self.active_connections if entry["websocket"] is not websocket
        ]

    def should_receive(self, entry: dict, message: dict) -> bool:
        target_doctor_id = message.get("doctor_id")
        target_request_id = message.get("request_id")

        if entry["request_id"] is not None:
            return target_request_id == entry["request_id"]

        if entry["doctor_id"] is not None:
            if target_doctor_id is not None and int(target_doctor_id) != int(entry["doctor_id"]):
                return False
            return True

        return False

    async def broadcast(self, message: dict):
        for entry in list(self.active_connections):
            websocket = entry["websocket"]
            try:
                if not self.should_receive(entry, message):
                    continue
                await websocket.send_json(message)
            except Exception:
                self.disconnect(websocket)


manager = ConnectionManager()
