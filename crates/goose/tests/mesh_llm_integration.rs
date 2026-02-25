/// Integration test: prove mesh-llm crate works as a goose dependency.
/// Loads a model in-process via Engine::solo(), generates a response,
/// and verifies streaming + usage tracking work.
///
/// Run: cargo test -p goose --test mesh_llm_integration -- --nocapture
///
/// Requires: ~/.models/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf on disk

use mesh_llm::Engine;

const TEST_MODEL: &str = concat!(
    env!("HOME"),
    "/.models/Qwen2.5-0.5B-Instruct-Q4_K_M.gguf"
);

#[tokio::test]
async fn test_solo_streaming() {
    if !std::path::Path::new(TEST_MODEL).exists() {
        eprintln!("SKIP: model not found at {TEST_MODEL}");
        return;
    }

    let engine = Engine::solo(TEST_MODEL).expect("failed to load model");

    // Streaming
    let mut stream = engine.chat(&[("user", "What is 2+2? Reply with just the number.")]);
    let mut text = String::new();
    while let Some(piece) = stream.next().await {
        text.push_str(&piece);
    }

    eprintln!("Response: {text}");
    assert!(text.contains('4'), "Expected '4' in response, got: {text}");

    // Usage
    let usage = stream.usage().expect("usage should be available after stream");
    assert!(usage.prompt_tokens > 0, "prompt_tokens should be > 0");
    assert!(usage.completion_tokens > 0, "completion_tokens should be > 0");
    eprintln!(
        "Usage: prompt={}, completion={}, total={}",
        usage.prompt_tokens, usage.completion_tokens, usage.total_tokens
    );
}

#[tokio::test]
async fn test_solo_blocking() {
    if !std::path::Path::new(TEST_MODEL).exists() {
        eprintln!("SKIP: model not found at {TEST_MODEL}");
        return;
    }

    let engine = Engine::solo(TEST_MODEL).expect("failed to load model");

    let reply = engine
        .chat_blocking(&[
            ("user", "My name is Alice. Say OK."),
            ("assistant", "OK"),
            ("user", "What is my name? Reply with just the name."),
        ])
        .await
        .expect("chat_blocking failed");

    eprintln!("Response: {reply}");
    assert!(
        reply.contains("Alice"),
        "Expected 'Alice' in response, got: {reply}"
    );
}
