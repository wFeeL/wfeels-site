from pydantic import BaseModel, Field


class LeadIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    contact: str = Field(min_length=3, max_length=120)
    message: str = Field(min_length=10, max_length=4000)
    budget: str | None = Field(default=None, max_length=60)
    page: str = Field(default="", max_length=200)
    website: str = Field(default="", max_length=200)  # приманка, обязана быть пустой
    consent: str = Field(default="", max_length=20)
    elapsed_seconds: float = 0.0
