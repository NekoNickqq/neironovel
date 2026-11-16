import asyncio
from datetime import datetime

log_queue = asyncio.Queue()

async def log_event(event_type: str, data: dict):
    await log_queue.put({"type": event_type, "data": data, "timestamp": datetime.utcnow().isoformat()})