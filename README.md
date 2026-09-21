# Tokenlab — Tokenizer, Converter and Cost Lab

A small web app that works like OpenAI's tokenizer page, but does more: live token
splitting, a both-way words/tokens converter, a cost calculator, and a price table
of 60+ real models (including open-weight ones like Llama, DeepSeek, Qwen, MiMo
and MiniMax). I built it as a learning project to understand how LLMs turn text
into tokens and how API pricing actually works.

## The idea

Every LLM API charges per token, not per word. Before sending a prompt (or paying
a bill), it helps to know: how many tokens is my text, how many words is that,
and what will it cost on each model? This app answers all three on one page.

## Features

- Tokenizer: paste text, see the exact token split, token IDs, and stats
  (tokens, words, characters, sentences, density). 4 exact OpenAI encodings
  (o200k, cl100k, p50k, r50k) plus honest approximations for other families.
- Token ID decoder: paste IDs back and get the text.
- Both-way converter: tokens to words, words to tokens, characters included,
  plus one-click boxes and a reply-length estimator.
- Cost calculator: input/output tokens and requests per month, with monthly and
  yearly totals and the cheapest 5 models for your workload.
- Model table: 61 models with per-million-token prices, context windows and
  filters. Any row can be sent straight into the calculator.
- First-run guide: a short welcome overlay for new users (shown once).

## Tech stack

- Plain HTML, CSS and JavaScript. No framework, no build step, no backend.
- Real byte-level BPE tokenization in `bpe.js`, using the official vocabulary
  files vendored under `ranks/`. Verified bit-identical to OpenAI's `tiktoken`
  on 20 test cases (4 encodings x prose, code, German and emoji text).
- Model prices are a static snapshot (September 2026) in `models.js`.
- Fonts are loaded from Google Fonts with system fallbacks, so the page still
  works offline.

## How I made it

1. Started with a single page: a textarea on the left, live stats on the right.
2. Added the converter (both directions) and the cost math, which is just
   `(input / 1M x input price) + (output / 1M x output price)`.
3. Collected real pricing from provider docs into a 61-model table.
4. Tested my first tokenizer against the real `tiktoken` library and found it
   overcounted by about 50 percent, so I replaced it with a real BPE engine
   and re-tested until all 20 checks passed exactly.
5. Added a welcome overlay so a first-time user understands the page in
   30 seconds, then polished the styling.

## What I learnt

- What a token actually is: not a word and not a character, but a chunk from a
  fixed vocabulary, built with byte-pair encoding.
- Why token counts differ per model family: each vendor trains its own
  vocabulary, so only the vendor's own tokenizer is ever exact.
- How to read a regex carefully: one missing `?` in the split pattern broke a
  whole encoding, and the test suite caught it.
- How API pricing works: input vs output rates, context windows, and why short
  replies save more money than short prompts.
- That a static frontend with no backend is enough for a tool like this, and
  that verifying with real data beats assuming the code is right.

## Run it locally (Windows)

You only need Python installed. Open a terminal (press Win + R, type `cmd`,
press Enter), then run:

```
cd /d C:\Users\sfors\OneDrive\Desktop\TokenCalculater
python -m http.server 8000
```

Then open this address in your browser:

```
http://localhost:8000
```

To stop the server later, press Ctrl + C in the terminal.

Note: open it through `localhost` (not by double-clicking `index.html`),
because browsers block the vocabulary files on `file://` and the counts would
fall back to rough estimates.

## Project structure

```
index.html   page structure (tokenizer, converter, cost, models, welcome)
styles.css   all styling, warm minimal theme
app.js       UI logic, converter math, cost math, table rendering
bpe.js       exact BPE tokenizer (classic script, no dependencies)
models.js    61 models with prices, context windows and providers
ranks/       official BPE vocabulary files (o200k, cl100k, p50k, r50k)
```

## Notes and limits

- Prices are list prices from September 2026, per million tokens, before
  caching, batch or volume discounts. Always confirm on the provider's page
  before budgeting.
- Counts for non-OpenAI model families are close approximations, and the app
  labels them as such.
- Nothing leaves your computer: all counting happens in the browser.
