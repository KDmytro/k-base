# Agentic Architecture

Upgrading from direct LiteLLM API calls to agentic frameworks for tool use, self-directed tasks, and structured outputs.

## Key Distinction: Branching ≠ Agent Delegation

K-Base branches are **session forks** (same agent, different timeline) not agent handoffs:

| K-Base Concept | What It Is | NOT This |
|----------------|------------|----------|
| Branch | Fork conversation state at a point | Handoff to specialist agent |
| Side chat | Scoped sub-session with limited context | Subagent with different instructions |
| Multiple branches | Parallel exploration of same question | Multi-agent orchestration |

The existing Node tree with `parent_id` already handles session state. Agentic frameworks add tool use, not session management.

---

## Chat Modes

```
┌─────────────────────────────────────────────────────────────┐
│  Regular Chat          Agentic Mode           Side Chat      │
│  ─────────────         ───────────            ─────────      │
│  Single turn           Self-directed loop     Scoped Q&A     │
│  No tool use           Tools + verification   No tools       │
│  User drives           Agent drives           User drives    │
│  Current behavior      NEW                    Current        │
│                                                              │
│  "Explain X"           "Research X and        "What does     │
│                         summarize findings"    this mean?"   │
└─────────────────────────────────────────────────────────────┘
```

### Triggering Agentic Mode

- **Explicit**: User clicks "Deep Research" button or `/agent` command
- **Implicit**: Detected from prompt patterns ("find all X and compare", "build me a quiz")
- **Per-topic setting**: Some topics default to agentic mode

---

## Provider Strategy

### Phase 1: Anthropic Agent SDK
- Start with Claude models
- Leverage Agent Skills ecosystem (Notion, Zapier, Stripe integrations)
- Use agentic loop: Gather Context → Take Action → Verify Work → Repeat

### Phase 2: OpenAI Agents SDK
- Add GPT model support
- Handoffs for multi-step workflows
- Built-in tracing (aligns with Observability goals)
- Sessions for conversation state

### Shared Layer: PydanticAI
- Type-safe tool definitions that work with either provider
- Structured outputs (quiz questions, summaries, search results)
- Validation and guardrails

---

## Implementation Layers

```
┌─────────────────────────────────────────┐
│           PydanticAI                     │  ← Shared tool definitions,
│     (structured outputs, validation)     │    type-safe, provider-agnostic
├─────────────────────────────────────────┤
│  Anthropic Agent SDK  │  OpenAI Agents  │  ← Provider-specific agentic loops
│     (Claude models)   │   (GPT models)  │    when agentic mode triggered
├─────────────────────────────────────────┤
│         LiteLLM (simple completions)     │  ← Regular chat, side chats
│              Current implementation      │    (keep as-is)
└─────────────────────────────────────────┘
```

---

## Tool Ideas

| Tool | Purpose | Mode |
|------|---------|------|
| `search_memory` | RAG search across topic | Agentic |
| `generate_quiz` | Create quiz from conversation | Agentic |
| `summarize_branch` | Condense branch for collapsing | Both |
| `web_search` | Fetch external information | Agentic |
| `execute_code` | Run Python in sandbox | Agentic |
| `create_diagram` | Generate Mermaid/visualization | Agentic |

---

## Example: PydanticAI Tool Definitions

```python
from pydantic import BaseModel
from pydantic_ai import Tool

class RAGSearchResult(BaseModel):
    content: str
    source_node_id: str
    relevance: float

class QuizQuestion(BaseModel):
    question: str
    options: list[str]
    correct_index: int
    explanation: str

# Shared across Anthropic and OpenAI agents
rag_tool = Tool(
    name="search_memory",
    description="Search topic knowledge base for relevant context",
    output_type=list[RAGSearchResult],
    fn=memory_service.search
)

quiz_tool = Tool(
    name="generate_quiz",
    description="Generate assessment questions from conversation content",
    output_type=list[QuizQuestion],
    fn=quiz_service.generate
)
```

---

## Open Questions

- [ ] How to display agentic "thinking" steps to user? Streaming intermediate results?
- [ ] Should agentic responses create multiple nodes (one per tool use) or single node with full result?
- [ ] Token/cost budgets for agentic loops - prevent runaway agents
- [ ] How to handle agent failures gracefully - fallback to simple chat?

---

## Framework Comparison

### Anthropic Agent SDK

| Aspect | Details |
|--------|---------|
| **Mental Model** | "Give Claude a computer" - file system, terminal, tools |
| **Agentic Loop** | Gather Context → Take Action → Verify Work → Repeat |
| **Tools** | Custom tools, Bash, MCP integrations |
| **Context Management** | Compaction (auto-summarize at limit) |
| **Verification** | Rules-based, visual feedback, LLM-as-judge |
| **Ecosystem** | Agent Skills (Notion, Zapier, Stripe, etc.) |

### OpenAI Agents SDK

| Aspect | Details |
|--------|---------|
| **Mental Model** | "Agents with handoffs" - delegation & orchestration |
| **Primitives** | Agents, Handoffs, Guardrails, Sessions |
| **Tools** | Function tools (auto-schema from Python) |
| **Memory** | Sessions (auto conversation history) |
| **Tracing** | Built-in + external integrations |
| **Multi-language** | Python + TypeScript SDKs |

### Why Both?

- **Anthropic first**: Deeper agentic loop with verification, Skills ecosystem
- **OpenAI second**: Provider flexibility, built-in tracing, wider model support
- **PydanticAI shared**: Type-safe tools work with either, no lock-in

---

## References

- [Anthropic Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Anthropic Agent Skills](https://agentskills.io)
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)
- [PydanticAI](https://ai.pydantic.dev/)

---

*Created: 2026-01-15*
