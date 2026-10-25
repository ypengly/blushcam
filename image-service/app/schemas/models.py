from __future__ import annotations

from pydantic import BaseModel, Field


class OperationInfo(BaseModel):
    operation: str
    label: str
    available: bool
    kind: str = Field(description="local-classical | external-provider | unavailable")
    reason: str
    external: bool = Field(description="True if the photo would be sent to a third party")


class CapabilitiesResponse(BaseModel):
    operations: list[OperationInfo]


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    detail: ErrorDetail


class HealthResponse(BaseModel):
    status: str = "ok"
