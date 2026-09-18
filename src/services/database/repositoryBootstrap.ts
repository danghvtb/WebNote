// Lazy boundary for startup-only repository helpers. This keeps the regular
// repository module out of the bootstrap import graph while preserving the
// existing local-first startup flow.
export { clearAllLocalData, getAllVaultNotebooks, getAllVaultPages, getVaultOwnerEmail } from './repository';
