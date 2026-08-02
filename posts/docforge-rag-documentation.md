---
title: "DocForge: Turning Software Docs Into a RAG-Ready Knowledge Base"
date: 2026-08-03
category: project
tags: [python, rag, documentation, embeddings, vector-search]
excerpt: "A build log for DocForge, the part where documentation stopped being pages I search manually and became something I could index, version, and query."
slug: docforge
---

I made DocForge because I kept running into the same annoying problem: official documentation is usually where the answers are, but getting the exact answer still means searching, opening tabs, jumping between versions, and hoping the page you found is the one that actually applies.

That is fine once or twice. It gets old fast when you are trying to build anything serious with an LLM sitting next to you. The model can help, but only if the context it gets is clean, current, and tied back to real sources. That was the idea behind DocForge: take official software documentation and turn it into a versioned, RAG-ready knowledge base.

Repository: [github.com/aritra0309/DocForge](https://github.com/aritra0309/DocForge)

Documentation: [aritra0309.github.io/DocForge](https://aritra0309.github.io/DocForge/)

## The problem I was actually trying to solve

This was not supposed to be "scrape some pages and dump them into a vector database." That version is easy to describe and usually messy to use.

Real documentation has structure. Some pages are tutorials. Some are API references. Some are guides. Some are mostly tables. Some are code-heavy. Some belong to PostgreSQL 17 and some belong to PostgreSQL 16, and mixing those up is exactly how you get confident but wrong answers.

So the first goal was not search. The first goal was getting the pipeline shape right:

```text
Discovery -> Crawler -> Extractor -> Classifier -> Chunker -> Metadata -> Embeddings -> Vector store -> Search
```

That sounds obvious after writing it down. It was less obvious while building it, because every stage has a tempting shortcut.

## Discovery came before crawling

My first instinct was to think about crawling. Point at a docs site, follow links, save pages, move on.

Future me knows that was already too vague. A crawler needs boundaries. It needs to know which URLs count, which version it is indexing, where sitemaps live, and what "latest" means for that software.

That is why DocForge has a software registry instead of only taking arbitrary URLs. The built-in registry currently covers PostgreSQL, MySQL, MongoDB, FastAPI, React, Kubernetes, and Redis. Each one can carry version information and discovery rules, which makes the crawl much less magical and much easier to reproduce.

## Extracting text was not enough

Once pages were being fetched, the next trap was thinking clean text would be enough. It was not.

For RAG, the format of the extracted content matters. Markdown headings help preserve hierarchy. Code blocks need to stay code blocks. Tables should not become random lines of text. Callouts should survive well enough that warnings and notes do not lose their meaning.

So DocForge converts pages into cleaner Markdown before chunking them. That made the rest of the pipeline easier to reason about, because chunks were no longer just arbitrary blobs from HTML.

## Chunking became the part I cared about more than expected

Before this project, I thought chunking was mostly "split every N tokens with overlap." That works as a baseline, but documentation is not one uniform material.

API reference pages want different treatment than tutorials. Code-heavy pages should not be split in the middle of a useful example if that can be avoided. Tables need their own handling. Guides often depend on nearby headings to make sense.

DocForge ended up with type-aware chunking for guides, tutorials, API references, code, and tables. It also keeps overlap logic separate, because overlap is useful, but only when it is intentional.

This was one of those parts where the architecture became less about elegance and more about damage control. Bad chunks produce bad retrieval. Bad retrieval makes the LLM look worse than it is.

## Versioning was not optional

The more I thought about real docs, the more versioning became unavoidable.

If I search for "how to create an index" in PostgreSQL, I do not only care about PostgreSQL. I care about which version of PostgreSQL. Same story for Kubernetes, React, MongoDB, and pretty much every tool with evolving docs.

So DocForge stores indexes with software and version metadata. Search can filter against that metadata instead of pretending all documentation lives in one timeless pile.

There is also support for incremental updates and re-embedding. That mattered because rebuilding everything from scratch every time is wasteful. If pages changed, DocForge should process the changed pages. If I want to move from one embedding model to another, I should not have to recrawl the internet first.

## I wanted replaceable pieces, not one locked stack

Another early design decision was making providers replaceable. I did not want the whole project to assume one embedding provider or one vector database forever.

DocForge supports Sentence Transformers, OpenAI, Voyage, BGE, and Jina for embeddings. For storage, it supports ChromaDB, FAISS, Qdrant, LanceDB, and Weaviate.

That sounds like a feature list, but the important part is the interface boundary. Discovery, fetching, extraction, chunking, embeddings, and vector storage all sit behind contracts. The pipeline should not care whether vectors end up in ChromaDB locally or Qdrant somewhere else.

## How this is different from other crawlers

There are already plenty of good crawling and scraping tools. I did not build DocForge because Scrapy, Firecrawl, Crawl4AI, Playwright, LangChain loaders, or LlamaIndex readers do not exist.

Scrapy is the classic serious Python crawler. If the job is "crawl a site and extract structured data," it is probably one of the first tools worth considering. Playwright is excellent when pages need a real browser. Firecrawl and Crawl4AI are closer to the current LLM use case, because they can return cleaner Markdown and handle more of the web extraction work for you. LangChain and LlamaIndex have loaders that make it easy to pull web pages into an LLM pipeline quickly.

DocForge is trying to sit in a narrower place than those tools. It is not a general web scraping framework, and it is not only a page-to-Markdown API wrapper. It is specifically for official software documentation where versions, source URLs, chunk types, metadata, and incremental updates matter.

That difference sounds small until you try to build a useful docs assistant.

If I use a general crawler, I still have to decide how to find versioned docs, how to avoid mixing versions, how to classify pages, how to chunk API references differently from tutorials, how to store metadata, how to re-embed without recrawling, and how to keep indexes updated. DocForge tries to make those decisions first-class parts of the tool instead of glue code I write around the crawler.

So the way I think about it is:

- **Scrapy** is stronger if I want a full scraping framework and I am comfortable building the rest of the pipeline myself.
- **Playwright** is stronger if the biggest problem is JavaScript rendering or browser automation.
- **Firecrawl** is stronger if I want a hosted API that quickly gives me clean LLM-ready output from websites.
- **Crawl4AI** is stronger if I want an open-source crawler focused on LLM-friendly extraction and browser-level control.
- **LangChain and LlamaIndex loaders** are stronger if I want to quickly get web content into an existing agent or RAG prototype.
- **DocForge** is stronger if the unit I care about is not "a webpage," but "versioned official documentation that should become a maintainable semantic index."

That is also why DocForge still has a lot it can learn from those tools. Better browser support, better structured extraction, better crawl observability, and better real-world crawling resilience are all obvious places to improve.

## The CLI made it feel real

At some point, a project stops feeling like a pile of modules and starts feeling like a tool. For DocForge, that happened when the CLI became usable:

```bash
docforge index postgresql --version 17
docforge search "how to create an index" --software postgresql --version 17 --top-k 5
docforge update postgresql
docforge reembed postgresql --model BAAI/bge-small-en-v1.5
docforge stats postgresql
```

The Python API exists too, but the CLI is what made the feedback loop short. Index something. Search it. Inspect stats. Delete it if the run was bad. Re-embed without starting over.

That loop matters a lot when you are still figuring out whether your chunks are useful.

## Documentation for the documentation tool

There is something funny about building a documentation tool and then realizing the docs for it have to be decent too.

I added a MkDocs site with a getting started guide, CLI reference, API reference, architecture page, plugin contracts, and changelog. Not because every tiny project needs a full docs site, but because this project is specifically about reproducible documentation pipelines. If the usage path is unclear, the whole thing becomes a little hypocritical.

The docs are here: [aritra0309.github.io/DocForge](https://aritra0309.github.io/DocForge/)

## What I would improve next

The current version is a solid foundation, but there are still obvious places to push it.

- **Better evaluation** for retrieval quality, because "the search result looks right to me" is not a real metric.
- **More registries** for popular frameworks and databases, since the registry approach gets more useful as coverage grows.
- **Better docs change reports** so updates can show exactly what changed between crawls.
- **More examples** showing real RAG workflows instead of only indexing and search commands.
- **JavaScript-rendered docs support** for sites that do not expose enough useful HTML without a browser.
- **A crawl report UI** showing skipped URLs, duplicate pages, failed fetches, chunk counts, token counts, and embedding cost before anything gets stored.
- **Quality scores per chunk** so obviously weak chunks can be reviewed, merged, split, or dropped.
- **Built-in evaluation datasets** for supported registries, so changes to chunking or embeddings can be measured instead of guessed.
- **Reranking support** after vector search, because nearest-neighbor retrieval alone is not always enough for documentation questions.
- **Hybrid search** combining vector search with keyword search, since exact API names and error strings matter a lot in software docs.
- **Better release/version diffing** so DocForge can answer not only "what does this doc say?" but also "what changed between version 16 and 17?"

If I were planning future versions properly, I would split them by maturity instead of trying to ship everything at once.

Version `0.2` would probably focus on reliability: stronger crawl reports, better failure handling, better tests against real documentation sites, and a clearer evaluation story.

Version `0.3` would focus on retrieval quality: hybrid search, reranking, chunk quality checks, and more realistic RAG examples.

Version `0.4` would focus on scale and operations: scheduled updates, crawl history, index health checks, and easier deployment against Qdrant, Weaviate, or another remote backend.

Version `1.0` would be the point where I would want the core promise to feel boring in the best way: pick official docs, index a version, update it later, search it reliably, and know exactly where every answer came from.

The main thing I learned from building DocForge is that RAG quality starts much earlier than the prompt. It starts at discovery, extraction, chunking, metadata, and version control. By the time the model sees context, most of the important decisions have already happened.

DocForge is my attempt to make those decisions explicit instead of hiding them inside a one-off script.
