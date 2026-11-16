import asyncio
from fastapi import Request

async def _run_with_cancel_check(request: Request, coro) -> any:
    gen_task = asyncio.create_task(coro)
    try:
        while True:
            done, _ = await asyncio.wait([gen_task], timeout=0.4)
            if done:
                return gen_task.result()
            if await request.is_disconnected():
                print("🛑 Client disconnected, cancelling generation...")
                gen_task.cancel()
                try:
                    await gen_task
                except asyncio.CancelledError:
                    pass
                raise asyncio.CancelledError()
    except asyncio.CancelledError:
        if not gen_task.done():
            gen_task.cancel()
        raise