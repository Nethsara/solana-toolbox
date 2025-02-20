import {
  Connection,
  PublicKey,
  clusterApiUrl,
  LAMPORTS_PER_SOL,
  ConfirmedSignatureInfo,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  AnyTransactionResponse,
  GetTransactionsResponse,
  PaginationOptions,
  RPCEndpoint,
} from "../interfaces/types";

/** Default token configurations; null represents native SOL */
const defaultTokenConfigs: Record<string, string | null> = {
  sol: null,
  usdc_sol: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
  // Add more tokens as needed
};

/** Supported Solana networks */
export type SolanaNetwork = "mainnet-beta" | "devnet" | "testnet";

/** RPC configuration for different networks */
const DEFAULT_RPC_CONFIGS: Record<SolanaNetwork, RPCEndpoint[]> = {
  "mainnet-beta": [{ url: clusterApiUrl("mainnet-beta"), weight: 1 }],
  devnet: [{ url: clusterApiUrl("devnet"), weight: 1 }],
  testnet: [{ url: clusterApiUrl("testnet"), weight: 1 }],
};

/** Connection pool to manage multiple connections */
class ConnectionPool {
  private connections: Map<string, Connection> = new Map();
  private currentIndex: Record<SolanaNetwork, number> = {
    "mainnet-beta": 0,
    devnet: 0,
    testnet: 0,
  };
  private rpcConfigs: Record<SolanaNetwork, RPCEndpoint[]>;

  constructor(
    rpcConfigs: Record<SolanaNetwork, RPCEndpoint[]> = DEFAULT_RPC_CONFIGS
  ) {
    this.rpcConfigs = rpcConfigs;
  }

  getConnection(network: SolanaNetwork): Connection {
    const endpoints = this.rpcConfigs[network];
    const currentIdx = this.currentIndex[network];

    // Rotate to next endpoint
    this.currentIndex[network] = (currentIdx + 1) % endpoints.length;

    const endpoint = endpoints[currentIdx];
    const key = `${network}-${endpoint.url}`;

    if (!this.connections.has(key)) {
      this.connections.set(key, new Connection(endpoint.url));
    }

    return this.connections.get(key)!;
  }
}

const connectionPool = new ConnectionPool();

/**
 * Returns a connection to the specified Solana network.
 */
function getConnection(network: SolanaNetwork): Connection {
  return connectionPool.getConnection(network);
}

/**
 * Fetches signatures for a given public key with pagination.
 *
 * @param connection - The Solana connection instance.
 * @param key - The public key to fetch signatures for.
 * @param options - Pagination options.
 * @returns A promise that resolves to an array of signature info.
 */
async function fetchSignatures(
  connection: Connection,
  key: PublicKey,
  options: PaginationOptions
): Promise<ConfirmedSignatureInfo[]> {
  return connection.getSignaturesForAddress(key, {
    limit: options.limit,
    before: options.before ?? undefined,
  });
}

/**
 * Fetches a transaction by its signature.
 *
 * @param connection - The Solana connection instance.
 * @param signature - The transaction signature.
 * @param transactionConfig - Configuration options for the transaction.
 * @returns A promise that resolves to a transaction response (legacy or versioned) or null.
 */
async function fetchTransaction(
  connection: Connection,
  signature: string,
  transactionConfig: { maxSupportedTransactionVersion: number }
): Promise<AnyTransactionResponse> {
  return connection.getTransaction(signature, transactionConfig);
}

/**
 * Type guard to check if a transaction message is legacy (i.e. contains accountKeys).
 *
 * @param message - The transaction message.
 * @returns True if legacy, false otherwise.
 */
function isLegacyMessage(message: any): message is { accountKeys: any[] } {
  return message && Array.isArray(message.accountKeys);
}

/**
 * Processes a SOL transaction into a simple loggable object.
 *
 * @param tx - The transaction response.
 * @returns An object with transaction details or null if invalid or unsupported.
 */
function processSolTransaction(tx: AnyTransactionResponse) {
  if (tx && tx.meta && tx.transaction) {
    const message = tx.transaction.message;
    if (!isLegacyMessage(message)) {
      console.warn(
        "Versioned transactions are not supported for SOL processing."
      );
      return null;
    }
    const preBalances = tx.meta.preBalances;
    const postBalances = tx.meta.postBalances;
    const accountKeys = message.accountKeys;

    const amount = Math.abs(
      (preBalances[0] - postBalances[0]) / LAMPORTS_PER_SOL
    );

    return {
      signature: tx.transaction.signatures[0],
      from: accountKeys[0].toString(),
      to: accountKeys[1].toString(),
      amount: `${amount} SOL`,
      timestamp: new Date((tx.blockTime || 0) * 1000).toLocaleString(),
    };
  }
  return null;
}

/**
 * Processes a token transaction into a simple loggable object.
 *
 * @param tx - The transaction response.
 * @param tokenMint - The token mint address.
 * @param tokenType - The token type.
 * @returns An object with transaction details or null if invalid or unsupported.
 */
function processTokenTransaction(
  tx: AnyTransactionResponse,
  tokenMint: string,
  tokenType: string
) {
  if (
    tx &&
    tx.meta &&
    tx.transaction &&
    tx.transaction.message &&
    isLegacyMessage(tx.transaction.message)
  ) {
    const tokenTransfer = tx.meta.postTokenBalances?.find(
      (balance) => balance.mint === tokenMint
    );

    if (tokenTransfer) {
      try {
        return {
          signature: tx.transaction.signatures[0],
          from: tx.transaction.message.accountKeys[0].toString(),
          to: tx.transaction.message.accountKeys[1].toString(),
          amount: `${tokenTransfer.uiTokenAmount.uiAmount}`,
          timestamp: new Date((tx.blockTime || 0) * 1000).toLocaleString(),
          tokenMint: tokenMint,
          tokenType: tokenType,
        };
      } catch (error: any) {
        console.warn(`Skipping malformed transaction: ${error.message}`);
      }
    }
  }
  return null;
}

/**
 * Retrieves and processes SOL transactions.
 *
 * @param connection - The Solana connection instance.
 * @param pubKey - The public key for which to retrieve transactions.
 * @param options - Pagination options.
 * @param transactionConfig - Transaction configuration.
 * @returns A promise that resolves to GetTransactionsResponse.
 */
async function getSolTransactions(
  connection: Connection,
  pubKey: PublicKey,
  options: PaginationOptions,
  transactionConfig: { maxSupportedTransactionVersion: number }
): Promise<GetTransactionsResponse> {
  const signatures = await fetchSignatures(connection, pubKey, options);

  const transactions = await Promise.all(
    signatures.map((sig) =>
      fetchTransaction(connection, sig.signature, transactionConfig)
    )
  );

  return {
    transactions,
    pagination: {
      before:
        signatures.length > 0
          ? signatures[signatures.length - 1].signature
          : null,
      hasMore: signatures.length === options.limit,
    },
  };
}

/**
 * Retrieves and processes token transactions.
 *
 * @param connection - The Solana connection instance.
 * @param pubKey - The public key for which to retrieve transactions.
 * @param tokenMint - The token mint address.
 * @param tokenType - The token type (e.g., "usdc_sol").
 * @param options - Pagination options.
 * @param transactionConfig - Transaction configuration.
 * @returns A promise that resolves to GetTransactionsResponse.
 */
async function getTokenTransactions(
  connection: Connection,
  pubKey: PublicKey,
  tokenMint: string,
  tokenType: string,
  options: PaginationOptions,
  transactionConfig: { maxSupportedTransactionVersion: number }
): Promise<GetTransactionsResponse> {
  const tokenMintPubKey = new PublicKey(tokenMint);

  // Get token accounts for the owner and mint
  const tokenAccounts = await connection.getTokenAccountsByOwner(pubKey, {
    programId: TOKEN_PROGRAM_ID,
    mint: tokenMintPubKey,
  });

  const allTransactions: AnyTransactionResponse[] = [];

  // Fetch transactions for each token account
  for (const { pubkey: tokenAccount } of tokenAccounts.value) {
    const signatures = await fetchSignatures(connection, tokenAccount, options);
    const transactions = await Promise.all(
      signatures.map((sig) =>
        fetchTransaction(connection, sig.signature, transactionConfig)
      )
    );
    allTransactions.push(...transactions);
  }

  return {
    transactions: allTransactions,
    pagination: {
      before:
        allTransactions.length > 0
          ? allTransactions[allTransactions.length - 1]?.transaction
              .signatures[0] || null
          : null,
      hasMore: allTransactions.length === options.limit,
    },
  };
}

/**
 * Retrieves transactions for a given wallet address and token type.
 *
 * @param address - The wallet address as a string.
 * @param tokenType - The token type (e.g., "sol" or "usdc_sol").
 * @param network - The Solana network to connect to.
 * @param options - Pagination options (limit and before signature).
 * @param tokenMapping - Custom token mapping configuration.
 * @param rpcConfigs - Custom RPC configuration for different networks.
 * @returns A promise that resolves with transactions and pagination info.
 */
export async function getTransactions(
  address: string,
  tokenType: string,
  network: SolanaNetwork = "mainnet-beta",
  options: PaginationOptions = { limit: 20, before: null },
  tokenMapping: Record<string, string | null> = defaultTokenConfigs,
  rpcConfigs: Record<SolanaNetwork, RPCEndpoint[]> = DEFAULT_RPC_CONFIGS
): Promise<GetTransactionsResponse> {
  const pool = new ConnectionPool(rpcConfigs);
  const connection = pool.getConnection(network);
  const pubKey = new PublicKey(address);
  const transactionConfig = { maxSupportedTransactionVersion: 0 };

  // Determine the token mint address based on tokenType using provided mapping
  const tokenMint = tokenMapping[tokenType.toLowerCase()];

  if (tokenType.toLowerCase() === "sol") {
    return getSolTransactions(connection, pubKey, options, transactionConfig);
  } else {
    if (!tokenMint) {
      throw new Error("Unsupported token type");
    }
    return getTokenTransactions(
      connection,
      pubKey,
      tokenMint,
      tokenType,
      options,
      transactionConfig
    );
  }
}

// Make these functions exportable if needed for testing or advanced usage
export {
  getConnection,
  fetchSignatures,
  fetchTransaction,
  processSolTransaction,
  processTokenTransaction,
  getSolTransactions,
  getTokenTransactions,
};
