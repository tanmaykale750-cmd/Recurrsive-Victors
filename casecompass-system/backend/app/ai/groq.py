"""Groq client (OpenAI-compatible chat completions) with JSON output.

The AI is an assistant, never the authority:
  * it only sees sentences that the deterministic parser already found;
  * every date it returns must be one the parser found in that same sentence;
  * every quote it returns must be a verbatim substring of the source;
  * anything that fails those checks is rejected and listed as such.
If no key is configured, or the API fails, callers fall back to rule-based results.
"""
from __future__ import annotations

import json
import logging
import time

import httpx

from ..config import settings

log = logging.getLogger(__name__)


class AIUnavailable(Exception):
    pass


class GroqClient:
    def __init__(self) -> None:
        self.last_error: str | None = None

    @property
    def enabled(self) -> bool:
        return settings.ai_available

    def json_chat(self, system: str, user: str, *, max_tokens: int = 2500) -> dict:
        """Return the model's JSON object, or raise AIUnavailable."""
        if not self.enabled:
            raise AIUnavailable("No Groq API key configured")
        body = {
            "model": settings.groq_model,
            "temperature": 0,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        url = settings.groq_base_url.rstrip("/") + "/chat/completions"
        delay = 1.5
        for attempt in range(3):
            try:
                r = httpx.post(url, json=body, headers=headers, timeout=settings.groq_timeout_seconds)
                if r.status_code in (429, 500, 502, 503, 504) and attempt < 2:
                    time.sleep(delay)
                    delay *= 2
                    continue
                r.raise_for_status()
                content = r.json()["choices"][0]["message"]["content"]
                return json.loads(content)
            except (httpx.HTTPError, KeyError, ValueError, json.JSONDecodeError) as e:
                self.last_error = str(e)[:300]
                if attempt == 2:
                    log.warning("Groq request failed: %s", self.last_error)
                    raise AIUnavailable(self.last_error) from e
                time.sleep(delay)
                delay *= 2
        raise AIUnavailable("Groq request failed")


client = GroqClient()
