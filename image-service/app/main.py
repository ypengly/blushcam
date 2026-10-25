"""BlushCam image service. Photos are processed in memory only: nothing is written to disk, cached or logged."""
from fastapi import FastAPI

from .api.routes import router

app = FastAPI(title="BlushCam image service", version="0.1.0", docs_url="/docs", redoc_url=None)
app.include_router(router)
