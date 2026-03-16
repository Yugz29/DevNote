# DevNote — Stage 1 Report  
## Team Formation and Idea Development

**Project:** DevNote  
**Author:** Yann Duzelier  
**Date:** December 3, 2024  
**Contact:** yann.duzelier@holbertonstudents.com  

---

# 1. Team Formation

## Team Member

**Yann Duzelier** — Holberton School Student Developer  

### Roles

- User interface design and implementation  
- Server logic and API development  
- Database design  

### Justification

This is an individual project.  
I already built a prototype version in **Swift (macOS)** and want to create a more accessible and polished **cross-platform web version**.

### Work Standards

- Regular commits with clear messages  
- Testing before integration  
- Code documentation  

---

# 2. Brainstorming and Idea Research

## Process

Identification of daily problems experienced as a developer.

---

## Ideas Explored

| Idea | Description | Reason for Rejection |
|-----|-------------|---------------------|
| **DevNote** | Web app centralizing notes, snippets, and TODOs for developers | **Selected** |
| DevProgress | Collaborative dashboard for side-projects | Requires strong multi-user network effect |
| CryptoPrediction | Crypto trend detection dashboard | Saturated market, complex real-time data |
| OfflineChat | P2P messaging without internet | Too niche use case, networking complexity |
| MicroDevTool | Hardware device like Flipper Zero for developers | Off-topic |

---

# 3. Selected MVP: DevNote

## Identified Problem

Developers accumulate a large amount of information daily:

- snippets  
- commands  
- technical notes  
- links  
- TODOs  

These are often scattered across multiple tools.

### Consequences

- Time wasted finding information  
- Repeated searches for the same problems  
- Disorganized and hard-to-read notes  
- Difficult access from mobile devices  

---

## Proposed Solution

A **unified web application** accessible from any device to:

- centralize
- organize
- instantly retrieve technical knowledge

**Tagline**

> Your dev knowledge, everywhere, instantly.

---

## Target Audience

- Junior developers / students  
- Freelance developers managing multiple projects  
- Developers working with multiple languages and frameworks  

---

## Why DevNote?

### Selection Reasons

1. **Personally verified problem** — I experience it daily  
2. **Feasibility** — Realistic scope for an 8-week project  
3. **Differentiation** — Developer-focused instead of generic productivity tools (like Notion)  
4. **Existing experience** — A first macOS version already exists  

---

# MVP Scope

## What DevNote WILL Solve

- Fragmentation of technical notes  
- Time wasted searching previously discovered solutions  
- Lack of cross-platform accessibility  

---

## What DevNote WILL NOT Solve (MVP)

- Real-time collaboration  
- Advanced offline editing  
- Automatic GitHub / GitLab integration  

---

# Key Features

## In Scope (MVP)

- Create, edit, and organize **Markdown notes** (with Mermaid diagram support)  
- Save and organize **code snippets by language**  
- Manage **TODO lists** with status:
  - `pending`
  - `in_progress`
  - `done`

  and priorities:
  - `low`
  - `medium`
  - `high`

- **Instant global search** across the knowledge base (`Cmd + K`)

---

## Out of Scope (Post-MVP)

- Multi-user collaboration  
- Full offline mode  
- Browser extensions  
- Third-party integrations  

---

# Risks and Mitigations

| Risk | Impact | Mitigation |
|-----|------|-----------|
| Search performance with large number of notes | High | Optimized indexing and pagination |
| User data security | Critical | Password encryption, API security, input validation |
| Schedule delays | Medium | Strict prioritization of essential features |

---

# Existing Solutions

## Notion

**Similarities**

- Markdown notes  
- Flexible organization  

**Differences**

- DevNote focuses specifically on developers  
- Simpler and more focused experience  

---

## Obsidian

**Similarities**

- Markdown notes  
- Note linking  

**Differences**

- DevNote is **cloud-first**  
- Accessible from anywhere  

---

## SnippetsLab / Dash

**Similarities**

- Snippet management tools for developers  

**Differences**

- DevNote will be **free**  
- Fully **cross-platform (web)**  

---

# DevNote Positioning

**DevNote** aims to be a **free, minimalist, and cross-platform alternative** combining the strengths of these tools while focusing on one core goal:

> Instantly retrieve your developer knowledge.