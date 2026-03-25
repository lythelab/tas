# Testing Guide

Run tests:

```bash
npm test
```

Recommended CI steps:

```bash
npm ci
npm run build
npm test
```

What tests validate in MVP:

- core memory behavior
- event store metrics
- tool execution path
- runtime tool loop and final response behavior
- provider selection logic
- webhook secret token guard
