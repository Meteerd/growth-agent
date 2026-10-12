# Security

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting ("Report a vulnerability" under the Security tab of this repository), and include the steps to reproduce.

Scope worth knowing:
- API keys live only in `.env` (git-ignored). The public showcase runs with no keys and refuses every mutating API call (`src/proxy.ts`).
- Every paid provider call goes through a spend ledger with hard caps (`BUDGET_USD_*`).
- The engine never posts to social platforms and never spends ad money.
