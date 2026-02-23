# HackerBoard Documentation

![Type](https://img.shields.io/badge/Type-Documentation%20Hub-blue)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Node](https://img.shields.io/badge/Node.js-20+-green)
![Azure](https://img.shields.io/badge/Azure-App%20Service%20%2B%20ACR-blue)
![Auth](https://img.shields.io/badge/Auth-GitHub%20OAuth-orange)
![License](https://img.shields.io/badge/License-MIT-yellow)

> Live, interactive hackathon scoring dashboard — App Service for Linux Containers + ACR + Express + Cosmos DB NoSQL Serverless.

## Documentation Index

| Doc                              | Description                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Guide](guide.md)                | Features F1–F11, roles, NFRs, event workflow, and admin/participant walkthroughs                                 |
| [Architecture](architecture.md)  | Diagrams, resource table, networking, security model, CI/CD, cost estimate, ADRs, governance, and WAF assessment |
| [Operations](operations.md)      | End-to-end deployment, CI/CD setup, ongoing operations, troubleshooting, and FAQ                                 |
| [API Specification](api-spec.md) | All endpoint contracts with request/response schemas                                                             |

## Architecture Snapshot

```mermaid
flowchart LR
    Users --> EasyAuth["Easy Auth\nGitHub OAuth"]
    EasyAuth --> Express["Express 5.x\nSPA + API\nport 8080"]
    Express --> Cosmos["Cosmos DB NoSQL\nServerless\nPrivate Endpoint"]
    ACR["Container Registry"] -->|"acrPull · MI"| AppService["App Service\nLinux Container"]
    GHA["GitHub Actions"] -->|"docker push :latest"| ACR
    ACR -->|"CD webhook"| AppService
    AppService --> Express
```

## Feature Status

All 11 features delivered:

| #   | Feature                       | Role   |
| --- | ----------------------------- | ------ |
| F1  | Team Score Submission Form    | Member |
| F2  | Live Leaderboard              | All    |
| F3  | Grading Display               | All    |
| F4  | Award Categories              | Admin  |
| F5  | GitHub OAuth Authentication   | All    |
| F6  | JSON Score Upload             | Member |
| F7  | Attendee Registration         | All    |
| F8  | Admin Validation & Override   | Admin  |
| F9  | Attendee Bulk Entry           | Admin  |
| F10 | Random Team Assignment        | Admin  |
| F11 | Configurable Rubric Templates | Admin  |

## Getting Help

- Open a bug report or feature request in [GitHub Issues][issues]
- Ask architectural or usage questions in [GitHub Discussions][discussions]

[issues]: https://github.com/jonathan-vella/hacker-board/issues
[discussions]: https://github.com/jonathan-vella/hacker-board/discussions

---

[← Back to Repository](../README.md)
