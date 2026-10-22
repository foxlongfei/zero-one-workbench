# V0.2 automatic integration gate

This workflow is a **CI deployment test**, not a public product release.

- Runs every day and on explicit manual dispatch or relevant changes.
- Retrieves **the full upstream** openGym, checks Docker Compose configuration, starts its full services and calls the API health endpoint.
- Saves container status/logs and upstream revision as evidence even when checks fail.
- Opens or comments on an issue for failed runs; does not silently mark a failed task complete.
- Never copies the upstream exercise media into this repository.
- Does not claim browser/mobile login, training history persistence or public HTTPS deployment have been verified.

## Production work still required
Provision an authorized persistent host, configure HTTPS + RP_ID/ORIGIN, backup the data volume, deploy full upstream and test actual exercise creation and persistence across restart. CI ephemeral containers do not meet this gate.

## Security
Never commit credentials. GitHub Actions token uses read-only content permissions and issue write access solely for failure reporting. Third-party upstream revisions are recorded in artifacts; production upgrades require license/security review and tested rollback.
