use clap::Parser;
use rand::seq::SliceRandom;

#[derive(Parser)]
pub struct QuoteCommand {
    /// Show all available quotes instead of a random one
    #[arg(long)]
    all: bool,
}

const QUOTES: &[&str] = &[
    "The best way to predict the future is to create it.",
    "Life is what happens while you're busy making other plans.",
    "The only way to do great work is to love what you do.",
    "In the middle of difficulty lies opportunity.",
    "The journey of a thousand miles begins with one step.",
];

impl QuoteCommand {
    pub fn run(&self) -> anyhow::Result<()> {
        if self.all {
            println!("All available quotes:");
            for quote in QUOTES {
                println!("  - {}", quote);
            }
        } else {
            let mut rng = rand::thread_rng();
            if let Some(quote) = QUOTES.choose(&mut rng) {
                println!("Quote of the day:\n  {}", quote);
            }
        }
        Ok(())
    }
}