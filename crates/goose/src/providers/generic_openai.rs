use anyhow::Result;
use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use std::time::Duration;

use super::base::{ConfigKey, Provider, ProviderMetadata, ProviderUsage, Usage};
use super::errors::ProviderError;
use super::formats::openai::{create_request, get_usage, response_to_message};
use super::utils::{emit_debug_trace, get_model, handle_response_openai_compat, ImageFormat};
use crate::message::Message;
use crate::model::ModelConfig;
use mcp_core::tool::Tool;

pub const GENERIC_OPENAI_DEFAULT_MODEL: &str = "gpt-3.5-turbo";

#[derive(Debug, serde::Serialize)]
pub struct GenericOpenAiProvider {
    #[serde(skip)]
    client: Client,
    base_url: String,
    api_key: String,
    model: ModelConfig,
}

impl Default for GenericOpenAiProvider {
    fn default() -> Self {
        let model = ModelConfig::new(GenericOpenAiProvider::metadata().default_model);
        GenericOpenAiProvider::from_env(model).expect("Failed to initialize Generic OpenAI provider")
    }
}

impl GenericOpenAiProvider {
    pub fn from_env(model: ModelConfig) -> Result<Self> {
        let config = crate::config::Config::global();
        let api_key: String = config.get_secret("OPENAI_API_KEY")?;
        let base_url: String = config.get("OPENAI_API_BASE")?;
        let model_override = config.get("OPENAI_API_MODEL").ok();
        
        let model = if let Some(model_name) = model_override {
            ModelConfig::new(&model_name)
        } else {
            model
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(600))
            .build()?;

        Ok(Self {
            client,
            base_url,
            api_key,
            model,
        })
    }

    async fn post(&self, payload: Value) -> Result<Value, ProviderError> {
        let base_url = url::Url::parse(&self.base_url)
            .map_err(|e| ProviderError::RequestFailed(format!("Invalid base URL: {e}")))?;
        let url = base_url.join("v1/chat/completions").map_err(|e| {
            ProviderError::RequestFailed(format!("Failed to construct endpoint URL: {e}"))
        })?;

        let response = self
            .client
            .post(url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&payload)
            .send()
            .await?;

        handle_response_openai_compat(response).await
    }
}

#[async_trait]
impl Provider for GenericOpenAiProvider {
    fn metadata() -> ProviderMetadata {
        ProviderMetadata::new(
            "generic_openai",
            "Generic OpenAI Compatible",
            "OpenAI API compatible providers (e.g. Helicone)",
            GENERIC_OPENAI_DEFAULT_MODEL,
            vec![GENERIC_OPENAI_DEFAULT_MODEL.to_string()],
            "https://platform.openai.com/docs/api-reference",
            vec![
                ConfigKey::new("OPENAI_API_KEY", true, true, None),
                ConfigKey::new("OPENAI_API_BASE", true, false, None),
                ConfigKey::new("OPENAI_API_MODEL", false, false, Some(GENERIC_OPENAI_DEFAULT_MODEL)),
            ],
        )
    }

    fn get_model_config(&self) -> ModelConfig {
        self.model.clone()
    }

    #[tracing::instrument(
        skip(self, system, messages, tools),
        fields(model_config, input, output, input_tokens, output_tokens, total_tokens)
    )]
    async fn complete(
        &self,
        system: &str,
        messages: &[Message],
        tools: &[Tool],
    ) -> Result<(Message, ProviderUsage), ProviderError> {
        let payload = create_request(&self.model, system, messages, tools, &ImageFormat::OpenAi)?;

        // Make request
        let response = self.post(payload.clone()).await?;

        // Parse response
        let message = response_to_message(response.clone())?;
        let usage = match get_usage(&response) {
            Ok(usage) => usage,
            Err(ProviderError::UsageError(e)) => {
                tracing::warn!("Failed to get usage data: {}", e);
                Usage::default()
            }
            Err(e) => return Err(e),
        };
        let model = get_model(&response);
        emit_debug_trace(self, &payload, &response, &usage);
        Ok((message, ProviderUsage::new(model, usage)))
    }
}