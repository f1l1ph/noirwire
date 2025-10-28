# Documentation Index

> **Find what you need quickly** — Documentation for the NoirWire protocol

---

## Quick Links

| Audience             | Start Here                                                         | Then Read                                      |
| -------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| **Users**            | [DOCS.md](./DOCS.md)                                               | [FAQ](#faq)                                    |
| **Developers**       | [TECHNICAL.md](./TECHNICAL.md)                                     | [API.md](./API.md)                             |
| **Auditors**         | [TECHNICAL.md#security-analysis](./TECHNICAL.md#security-analysis) | Source code in `/external/noirwire-contracts/` |
| **PMs/Stakeholders** | [DOCS.md#how-noirwire-works](./DOCS.md#how-noirwire-works)         | [DOCS.md#FAQ](#faq)                            |

---

## Documentation Files

### 📖 [DOCS.md](./DOCS.md) — **Main User Documentation**

**For:** Everyone (users, PMs, general audience)  
**Size:** 641 lines | **Read time:** 15 minutes

**Contents:**

- How NoirWire works (Shield → Transfer → Unshield)
- Architecture overview
- Detailed explanation of all 3 ZK circuits
- Complete transaction flows with examples
- Security model & threat analysis
- Performance metrics
- Deployment info
- FAQ

**When to use:**
✅ First time learning about NoirWire  
✅ Explaining to stakeholders  
✅ Understanding privacy guarantees  
✅ Quick reference on operations

**Key sections:**

- [How NoirWire Works](./DOCS.md#how-noirwire-works) - 2-minute overview
- [Zero-Knowledge Circuits](./DOCS.md#zero-knowledge-circuits) - Deep circuit explanation
- [Security Model](./DOCS.md#security-model) - 8 threat models with defenses
- [FAQ](./DOCS.md#faq) - Common questions answered

---

### 💻 [TECHNICAL.md](./TECHNICAL.md) — **Developer & Auditor Reference**

**For:** Developers, auditors, security researchers  
**Size:** 909 lines | **Read time:** 30 minutes

**Contents:**

- Circuit implementation (Circom code)
- Solana program architecture
- Backend service design
- Frontend integration patterns
- Data structure specifications
- Security analysis
- Testing & verification
- Debugging tips

**When to use:**
✅ Building on top of NoirWire  
✅ Auditing the codebase  
✅ Understanding internals  
✅ Contributing code

**Key sections:**

- [Circuit Implementation](./TECHNICAL.md#circuit-implementation) - Full Circom code
- [Solana Program Architecture](./TECHNICAL.md#solana-program-architecture) - On-chain logic
- [Backend Services](./TECHNICAL.md#backend-services) - Indexer & sync
- [Security Analysis](./TECHNICAL.md#security-analysis) - Threat model deep dive

---

### 🔌 [API.md](./API.md) — **REST API Documentation**

**For:** Developers integrating with NoirWire  
**Size:** 537 lines | **Read time:** 10 minutes

**Contents:**

- All REST endpoints documented
- Request/response examples
- Error codes & handling
- Rate limiting info
- Code examples (TypeScript, cURL)
- Retry logic
- CORS & authentication

**When to use:**
✅ Building a frontend or integration  
✅ Debugging API issues  
✅ Understanding rate limits  
✅ Copy-paste code examples

**Key sections:**

- [Proof Generation](./API.md#proof-generation) - `/proof/generate` endpoint
- [Indexer Endpoints](./API.md#indexer-endpoints) - Merkle proof generation
- [Error Handling](./API.md#error-handling) - Status codes & retries
- [Code Examples](./API.md#code-examples) - TypeScript & cURL

---

### 📚 [ARCHITECTURE.md](./ARCHITECTURE.md) — **Legacy Technical Deep-Dive**

**For:** Comprehensive system understanding  
**Size:** 1426 lines | **Read time:** 45 minutes

**Contents:**

- Complete system overview with diagrams
- Circuits, program, indexer, frontend explained
- Full transaction flows
- Data structures
- Performance metrics
- Deployment architectures
- Roadmap (Phase 1-5)

**When to use:**
✅ Understanding complete system  
✅ Planning Phase 2+ features  
✅ Onboarding new team members  
✅ Architectural decisions

**Note:** Largely superseded by DOCS.md + TECHNICAL.md. Kept for comprehensive reference.

---

## Learning Paths

### 🚀 **Path 1: New User (10 minutes)**

```
1. DOCS.md → How NoirWire Works
   └─ Understand the 3 operations

2. DOCS.md → Transactions
   └─ See complete example flows

3. DOCS.md → Getting Started
   └─ Visit noirwire.com and try it
```

---

### 👨‍💻 **Path 2: New Developer (1 hour)**

```
1. DOCS.md → Architecture
   └─ System overview

2. TECHNICAL.md → Circuit Implementation
   └─ Understand Circom code

3. TECHNICAL.md → Backend Services
   └─ Learn Merkle tree indexer

4. API.md → All endpoints
   └─ Reference for integration

5. Code examples → TypeScript client
   └─ Start building
```

---

### 🔐 **Path 3: Security Auditor (2 hours)**

```
1. DOCS.md → Security Model
   └─ Understand threat model

2. TECHNICAL.md → Security Analysis
   └─ Deep cryptographic analysis

3. TECHNICAL.md → Circuit Implementation
   └─ Review Circom constraints

4. Source code audit
   ├─ /external/noirwire-contracts/zk-circuits/src/
   ├─ /external/noirwire-contracts/programs/zk-pool/src/
   ├─ /apps/api/src/indexer/
   └─ /apps/api/src/proof/

5. Run tests
   └─ npm run test:circuits && npm run test:api
```

---

### 📊 **Path 4: PM / Stakeholder (15 minutes)**

```
1. DOCS.md → How NoirWire Works
   └─ 2-minute overview

2. DOCS.md → Complete Flow example
   └─ See real transaction example

3. DOCS.md → Performance section
   └─ Understand costs & speed

4. DOCS.md → FAQ
   └─ Common concerns addressed
```

---

## Topic Lookup

### ZK Circuits

| Topic                    | Location                                                                       |
| ------------------------ | ------------------------------------------------------------------------------ |
| **How they work (user)** | [DOCS.md → Circuits](./DOCS.md#zero-knowledge-circuits)                        |
| **Circuit 1: Shield**    | [DOCS.md → Shield Circuit](./DOCS.md#circuit-1-shield-)                        |
| **Circuit 2: Transfer**  | [DOCS.md → Transfer Circuit](./DOCS.md#circuit-2-transfer-)                    |
| **Circuit 3: Unshield**  | [DOCS.md → Unshield Circuit](./DOCS.md#circuit-3-unshield-)                    |
| **Implementation (dev)** | [TECHNICAL.md → Circuit Implementation](./TECHNICAL.md#circuit-implementation) |
| **Circom source code**   | `/external/noirwire-contracts/zk-circuits/src/`                                |

---

### Solana Program

| Topic                   | Location                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| **How it works**        | [DOCS.md → Solana Smart Contracts](./DOCS.md#solana-smart-contracts) |
| **7 Instructions**      | [TECHNICAL.md → Program Structure](./TECHNICAL.md#program-structure) |
| **Security Features**   | [DOCS.md → Security Features](./DOCS.md#security-features)           |
| **Rust implementation** | `/external/noirwire-contracts/programs/zk-pool/src/`                 |

---

### Backend & Indexer

| Topic               | Location                                                                               |
| ------------------- | -------------------------------------------------------------------------------------- |
| **Architecture**    | [TECHNICAL.md → Backend Services](./TECHNICAL.md#backend-services)                     |
| **Merkle Tree**     | [TECHNICAL.md → Merkle Tree Implementation](./TECHNICAL.md#merkle-tree-implementation) |
| **Blockchain Sync** | [TECHNICAL.md → Blockchain Sync Listener](./TECHNICAL.md#blockchain-sync-listener)     |
| **API Endpoints**   | [API.md → All endpoints](./API.md)                                                     |
| **Source code**     | `/apps/api/src/`                                                                       |

---

### Privacy & Security

| Topic                         | Location                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| **Privacy guarantees**        | [DOCS.md → Privacy Guarantees](./DOCS.md#privacy-guarantees)                         |
| **Threat model**              | [DOCS.md → Threat Analysis](./DOCS.md#threat-analysis)                               |
| **Cryptographic security**    | [TECHNICAL.md → Cryptographic Assumptions](./TECHNICAL.md#cryptographic-assumptions) |
| **Potential vulnerabilities** | [TECHNICAL.md → Potential Vulnerabilities](./TECHNICAL.md#potential-vulnerabilities) |
| **Security checklist**        | [TECHNICAL.md → Testing & Verification](./TECHNICAL.md#testing--verification)        |

---

### Transactions

| Topic                   | Location                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Shield (deposit)**    | [DOCS.md → Shield Flow](./DOCS.md#shield-flow-deposit-into-privacy-pool)        |
| **Transfer (private)**  | [DOCS.md → Transfer Flow](./DOCS.md#transfer-flow-private-transfer)             |
| **Unshield (withdraw)** | [DOCS.md → Unshield Flow](./DOCS.md#unshield-flow-withdrawal-to-public-wallet)  |
| **Complete example**    | [DOCS.md → Complete Cycle](./DOCS.md#complete-shield--transfer--unshield-cycle) |
| **Implementation**      | [TECHNICAL.md → Frontend Integration](./TECHNICAL.md#frontend-integration)      |

---

### API

| Topic                | Location                                                 |
| -------------------- | -------------------------------------------------------- |
| **All endpoints**    | [API.md](./API.md)                                       |
| **Proof generation** | [API.md → Proof Generation](./API.md#proof-generation)   |
| **Merkle proofs**    | [API.md → Indexer Endpoints](./API.md#indexer-endpoints) |
| **Error handling**   | [API.md → Error Handling](./API.md#error-handling)       |
| **Code examples**    | [API.md → Code Examples](./API.md#code-examples)         |
| **Retry logic**      | [API.md → Retry Logic](./API.md#retry-logic)             |

---

## FAQ (Quick Answers)

### General

**Q: What is NoirWire?**  
👉 See [DOCS.md → How NoirWire Works](./DOCS.md#how-noirwire-works)

**Q: How is it different from Railgun?**  
👉 See [DOCS.md → FAQ](./DOCS.md#faq) (comparing privacy protocols)

**Q: Is it audited?**  
👉 See [DOCS.md → Deployments](./DOCS.md#deployments) (audit status)

---

### Privacy

**Q: Can the team see my transactions?**  
👉 See [DOCS.md → Privacy](./DOCS.md#privacy)

**Q: Is my balance private?**  
👉 See [DOCS.md → Security Model](./DOCS.md#security-model)

**Q: Can I be deanonymized?**  
👉 See [DOCS.md → FAQ](./DOCS.md#faq) (Q&A about deanonymization)

---

### Technical

**Q: How do ZK proofs work?**  
👉 See [DOCS.md → Zero-Knowledge Circuits](./DOCS.md#zero-knowledge-circuits)

**Q: Why does proof generation take 30 seconds?**  
👉 See [DOCS.md → FAQ](./DOCS.md#faq) (Q&A about performance)

**Q: How is double-spending prevented?**  
👉 See [DOCS.md → Double-Spending](./DOCS.md#-double-spending)

---

### Development

**Q: How do I integrate with NoirWire?**  
👉 Start with [TECHNICAL.md → Frontend Integration](./TECHNICAL.md#frontend-integration)

**Q: What are the API endpoints?**  
👉 See [API.md](./API.md)

**Q: How do I deploy locally?**  
👉 See [DOCS.md → Getting Started](./DOCS.md#getting-started)

---

## File Sizes

```
DOCS.md          641 lines  (18 KB)   - Main user documentation
TECHNICAL.md     909 lines  (24 KB)   - Developer reference
API.md           537 lines  (10 KB)   - REST API docs
ARCHITECTURE.md 1426 lines  (48 KB)   - Complete deep-dive (legacy)
─────────────────────────────────────
Total           3513 lines (100 KB)
```

---

## Source Code Map

| Component          | Location                                             | File Type                |
| ------------------ | ---------------------------------------------------- | ------------------------ |
| **ZK Circuits**    | `/external/noirwire-contracts/zk-circuits/src/`      | Circom                   |
| **Solana Program** | `/external/noirwire-contracts/programs/zk-pool/src/` | Rust/Anchor              |
| **Backend API**    | `/apps/api/src/`                                     | TypeScript/NestJS        |
| **Frontend**       | `/apps/web/`                                         | TypeScript/React/Next.js |
| **Config**         | `config.json`, `.env.local`                          | JSON, ENV                |

---

## Contributing

See the relevant documentation before contributing:

1. **Bug fixes:** [TECHNICAL.md → Testing & Verification](./TECHNICAL.md#testing--verification)
2. **New features:** Discuss in Discord first
3. **Audits:** Start with [TECHNICAL.md → Security Analysis](./TECHNICAL.md#security-analysis)
4. **Documentation:** Update corresponding .md file

---

## Support & Contact

- **Questions:** Discord → [join.noirwire.com](https://join.noirwire.com)
- **Bug reports:** GitHub Issues
- **Security:** security@noirwire.com
- **API support:** api-support@noirwire.com
- **General:** support@noirwire.com

---

## Version History

| Version | Date         | Changes                                              |
| ------- | ------------ | ---------------------------------------------------- |
| **1.1** | Oct 28, 2025 | Restructured docs into DOCS.md, TECHNICAL.md, API.md |
| **1.0** | Oct 28, 2025 | Initial documentation created                        |

---

**Last updated:** October 28, 2025  
**Status:** 🟢 Complete  
**Feedback:** [GitHub Issues](https://github.com/noirwire/protocol/issues) or [Discord](https://join.noirwire.com)
