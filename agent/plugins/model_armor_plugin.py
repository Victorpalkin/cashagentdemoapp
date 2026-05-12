"""Model Armor plugin — sanitizes LLM inputs and outputs via Google Model Armor."""

import logging
import os
from typing import Optional

from google.api_core import client_options
from google.cloud import modelarmor_v1
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.plugins.base_plugin import BasePlugin
from google.genai import types

logger = logging.getLogger(__name__)

_BLOCKED_MESSAGE = (
    "I'm unable to process this request as it was flagged by our safety filters. "
    "Please rephrase your question about treasury operations."
)


class ModelArmorPlugin(BasePlugin):

    def __init__(
        self,
        project_id: str,
        location: str,
        template_id: str,
    ):
        super().__init__(name="model_armor")
        self.template_name = (
            f"projects/{project_id}/locations/{location}/templates/{template_id}"
        )
        self._client = modelarmor_v1.ModelArmorClient(
            client_options=client_options.ClientOptions(
                api_endpoint=f"modelarmor.{location}.rep.googleapis.com"
            )
        )

    def _is_blocked(self, result: modelarmor_v1.SanitizationResult) -> bool:
        return (
            result.filter_match_state
            == modelarmor_v1.FilterMatchState.MATCH_FOUND
        )

    def _extract_user_text(self, llm_request: LlmRequest) -> str:
        if not llm_request.contents:
            return ""
        last = llm_request.contents[-1]
        if not last.parts:
            return ""
        return " ".join(p.text for p in last.parts if p.text)

    def _extract_response_text(self, llm_response: LlmResponse) -> str:
        if not llm_response.content or not llm_response.content.parts:
            return ""
        return " ".join(p.text for p in llm_response.content.parts if p.text)

    async def before_model_callback(
        self,
        *,
        callback_context: CallbackContext,
        llm_request: LlmRequest,
    ) -> Optional[LlmResponse]:
        user_text = self._extract_user_text(llm_request)
        if not user_text:
            return None

        try:
            response = self._client.sanitize_user_prompt(
                request=modelarmor_v1.SanitizeUserPromptRequest(
                    name=self.template_name,
                    user_prompt_data=modelarmor_v1.DataItem(text=user_text),
                )
            )
            if self._is_blocked(response.sanitization_result):
                filters = response.sanitization_result.filter_results
                logger.warning("Model Armor blocked user input: %s", dict(filters))
                return LlmResponse(
                    content=types.Content(
                        role="model",
                        parts=[types.Part(text=_BLOCKED_MESSAGE)],
                    ),
                    turn_complete=True,
                )
        except Exception:
            logger.exception("Model Armor sanitize_user_prompt failed")

        return None

    async def after_model_callback(
        self,
        *,
        callback_context: CallbackContext,
        llm_response: LlmResponse,
    ) -> Optional[LlmResponse]:
        response_text = self._extract_response_text(llm_response)
        if not response_text:
            return None

        try:
            response = self._client.sanitize_model_response(
                request=modelarmor_v1.SanitizeModelResponseRequest(
                    name=self.template_name,
                    model_response_data=modelarmor_v1.DataItem(text=response_text),
                )
            )
            if self._is_blocked(response.sanitization_result):
                filters = response.sanitization_result.filter_results
                logger.warning("Model Armor blocked model output: %s", dict(filters))
                return LlmResponse(
                    content=types.Content(
                        role="model",
                        parts=[types.Part(text=_BLOCKED_MESSAGE)],
                    ),
                    turn_complete=True,
                )
        except Exception:
            logger.exception("Model Armor sanitize_model_response failed")

        return None
