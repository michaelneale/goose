use anyhow::Result;
use rand::seq::SliceRandom;

pub fn get_quote_of_the_day() -> Result<()> {
    let quotes = vec![
        ("The only way to do great work is to love what you do.", "Steve Jobs"),
        ("Be the change you wish to see in the world.", "Mahatma Gandhi"),
        ("Stay hungry, stay foolish.", "Steve Jobs"),
        ("Innovation distinguishes between a leader and a follower.", "Steve Jobs"),
        ("The future belongs to those who believe in the beauty of their dreams.", "Eleanor Roosevelt"),
    ];

    let mut rng = rand::thread_rng();
    if let Some(&(quote, author)) = quotes.choose(&mut rng) {
        println!("\n🪿 Quote of the day:\n\n  \"{}\"\n  - {}\n", quote, author);
    }

    Ok(())
}