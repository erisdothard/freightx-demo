# LangGraph Skill

## Agent patterns

- Define state with TypedDict
- Each node is a pure function: state_in → state_out
- Use conditional_edges for branching logic
- Checkpointing: use MemorySaver for dev, PostgresSaver for prod

## Model tiers

- Haiku: research, fetch, summarize
- Sonnet: synthesis, code generation, analysis
- Opus: final review, high-stakes decisions only

## Fan-out pattern

```python
# Spawn parallel research agents
graph.add_node("fan_out", run_parallel_agents)
graph.add_node("synthesize", synthesizer_agent)
graph.add_edge("fan_out", "synthesize")
```

## Token discipline

- Set max_tokens explicitly on every LLM call
- Use streaming for long outputs
- Never pass full conversation history if a summary suffices
