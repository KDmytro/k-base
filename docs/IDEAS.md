# K-Base Ideas & Future Features

Raw brainstorming and feature ideas for future development.

## Deep Dive Documents

- [Branch Merge Feature](./ai-merge.md) - Merging content from one branch into another

---

## Topic Management Enhancements

### 3-Dot Menu for Topics
Add dropdown menu with:
- **Add Summary** - AI-generated or manual summary of the topic
- **Rename** - Quick rename without opening
- **Delete/Archive** - Soft delete with archive option
- **Add Special Items** (see below)

### Special Topic Items
Interactive components that can be added to topics:

#### Terminal
- Embedded terminal for code execution
- Sandboxed environment per topic
- Persist command history in conversation
- Output captured as nodes?

#### Quiz/Assessor
- Generate quizzes from conversation content
- Track learning progress
- Spaced repetition integration?
- Assessment modes: multiple choice, free text, code challenges

#### Custom Agent
- Topic-specific AI persona/instructions
- Custom system prompts per topic
- Specialized knowledge injection
- Different LLM models per topic?

#### Interactive Components
- On-the-fly mini-apps within conversations
- Code playgrounds (JS, Python, etc.)
- Diagram/whiteboard tools
- Data visualization widgets
- Form builders for structured input

---

## Other Ideas

### Session Features
- [ ] Session templates (start with predefined structure)
- [ ] Session export (markdown, PDF, JSON)
- [ ] Session sharing (public links?)
- [ ] Session duplication/forking
- [ ] **Promote side chat to session** - Convert a side chat thread into a standalone session
  - Options: copy vs link (preserve original side chat or move it)
  - Context inheritance: include parent conversation summary or start fresh
  - Navigation: maintain link back to source message for reference

### Conversation Features
- [ ] Message reactions/ratings
- [ ] Bookmark important messages
- [ ] Search within session
- [ ] Filter by node type

### Collaboration
- [ ] Multi-user sessions
- [ ] Comments on branches
- [ ] Suggested branches from AI
- [ ] Branch comparison view

### AI Enhancements
- [ ] Multiple AI personas in same conversation
- [ ] AI-suggested follow-up questions
- [ ] Auto-summarize long branches
- [ ] Detect and link related topics

### Integration Ideas
- [ ] Import from ChatGPT/Claude exports
- [ ] Obsidian-style linking between topics
- [ ] Calendar integration for learning schedules
- [ ] Webhook triggers on events

---

## Observability & Quality

### Tracing
- [ ] LLM call tracing (inputs, outputs, latency, tokens)
- [ ] Request tracing across frontend/backend
- [ ] OpenTelemetry integration
- [ ] Trace visualization dashboard
- [ ] Cost tracking per topic/session

### Logging
- [ ] Structured logging (JSON)
- [ ] Log aggregation (Loki, CloudWatch, etc.)
- [ ] Error tracking (Sentry integration)
- [ ] User action audit logs
- [ ] Debug mode for development

### Evals & Quality
- [ ] Response quality scoring
- [ ] User feedback collection (thumbs up/down)
- [ ] A/B testing different prompts/models
- [ ] Automated eval pipelines
- [ ] Regression testing for prompt changes
- [ ] Hallucination detection
- [ ] Response latency benchmarks

### Monitoring
- [ ] Health check endpoints
- [ ] Metrics dashboard (Grafana)
- [ ] Alerting on errors/latency
- [ ] Token usage monitoring
- [ ] Rate limit tracking

---

## Technical Debt / Improvements

- [ ] Offline support (PWA)
- [ ] Mobile responsive design
- [ ] Keyboard navigation
- [ ] Undo/redo for edits
- [ ] Real-time collaboration (WebSockets)

---

*Last Updated: 2026-01-04*
