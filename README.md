# Solana Tool Box

This package provides a set of utilities for retrieving and processing transactions from the Solana blockchain. It supports both native SOL and token transactions (using legacy transaction processing) and handles pagination when fetching transaction signatures.

## Features

- **Solana Connection:** Connects to the Solana devnet.
- **Pagination:** Supports paginated fetching of transaction signatures.
- **SOL & Token Transactions:** Processes native SOL transactions and token transactions.
- **Type Safety:** Uses TypeScript with type guards and union types to handle legacy and versioned transactions.

## Installation

Install the required dependencies via npm:

    npm install solana-toolbox

Then, add this package to your project.

## Usage

Import the `getTransactions` function and call it with the wallet address, token type, and optional pagination options:

    import { getTransactions } from "solana-toolbox";

    // Example usage with custom token mapping:
    const customTokenMapping = {
        sol: null,
        usdc_sol: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
        my_custom_token: "CustomTokenMintAddress..."
    };

    const transactions = await getTransactions(
        'WALLET_ADDRESS',
        'my_custom_token',
        'mainnet-beta',
        { limit: 20 },
        customTokenMapping
    );

## API Documentation

### Types

#### `PaginationOptions`

    interface PaginationOptions {
      limit: number;
      before: string | null;
    }

Defines options for pagination when fetching transaction signatures.

#### `TransactionPagination`

    interface TransactionPagination {
      before: string | null;
      hasMore: boolean;
    }

Contains pagination details in the response.

#### `GetTransactionsResponse`

    interface GetTransactionsResponse {
      transactions: (TransactionResponse | VersionedTransactionResponse | null)[];
      pagination: TransactionPagination;
    }

The response returned by `getTransactions`, containing an array of transactions and pagination info.

### Functions

#### `getConnection(): Connection`

Returns a new connection to the Solana devnet.

#### `fetchSignatures(connection, key, options): Promise<ConfirmedSignatureInfo[]>`

Fetches transaction signature info for a given public key using the specified pagination options.

- **Parameters:**
  - `connection`: The Solana connection instance.
  - `key`: The public key to fetch signatures for.
  - `options`: Pagination options.

#### `fetchTransaction(connection, signature, transactionConfig): Promise<AnyTransactionResponse>`

Fetches a transaction from the blockchain using its signature and configuration.

- **Parameters:**
  - `connection`: The Solana connection instance.
  - `signature`: The transaction signature.
  - `transactionConfig`: Configuration options for the transaction.
- **Returns:**  
  A transaction response that can be a legacy or versioned transaction, or `null`.

#### `isLegacyMessage(message): boolean`

Type guard to check if a transaction message is legacy by verifying the presence of `accountKeys`.

#### `processSolTransaction(tx): any`

Processes a SOL transaction and returns a simplified object containing:

- `signature`
- `from` and `to` addresses
- `amount` in SOL
- `timestamp`

If the transaction is versioned or malformed, it returns `null`.

#### `processTokenTransaction(tx, tokenMint, tokenType): any`

Processes a token transaction and returns a simplified object containing:

- `signature`
- `from` and `to` addresses
- `amount` (with the token type)
- `timestamp`

Returns `null` if the transaction is invalid or unsupported.

#### `getSolTransactions(connection, pubKey, options, transactionConfig): Promise<GetTransactionsResponse>`

Retrieves and processes SOL transactions for the specified public key.

- **Parameters:**
  - `connection`: The Solana connection.
  - `pubKey`: The public key for the wallet.
  - `options`: Pagination options.
  - `transactionConfig`: Transaction configuration.
- **Returns:**  
  An object containing an array of transactions and pagination details.

#### `getTokenTransactions(connection, pubKey, tokenMint, tokenType, options, transactionConfig): Promise<GetTransactionsResponse>`

Retrieves and processes token transactions for a given wallet and token mint.

- **Parameters:**
  - `connection`: The Solana connection.
  - `pubKey`: The wallet's public key.
  - `tokenMint`: The mint address of the token.
  - `tokenType`: The token type (e.g., `"usdc_sol"`).
  - `options`: Pagination options.
  - `transactionConfig`: Transaction configuration.
- **Returns:**  
  An object containing an array of token transactions and pagination details.

#### `getTransactions(address, tokenType, options): Promise<GetTransactionsResponse>`

Main exported function that retrieves transactions for a given wallet address and token type.

- **Parameters:**
  - `address`: Solana wallet address
  - `tokenType`: Transaction type to fetch ("sol" for native SOL, "usdc_sol" for USDC, etc.)
  - `options`: Pagination configuration (optional)
  - `config`: Solana connection configuration (optional)
- **Returns:**  
  Promise resolving to `GetTransactionsResponse` containing processed transactions and pagination info
- **Throws:**  
  `InvalidTokenTypeError`: When an unsupported token type is provided
  `ConnectionError`: When unable to establish connection to Solana network
  `TransactionFetchError`: When transaction retrieval fails

## Error Handling

The package implements comprehensive error handling:

- An error is thrown if an unsupported token type is passed to `getTransactions`.
- For SOL transactions, versioned transactions are currently not supported for processing. A warning is logged if encountered.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
