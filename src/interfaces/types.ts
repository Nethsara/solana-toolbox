import { TransactionResponse } from "@solana/web3.js";
import { VersionedTransactionResponse } from "@solana/web3.js";

/** Pagination options for fetching transaction signatures */
export interface PaginationOptions {
  limit: number;
  before: string | null;
}

/** Structure for the pagination information in the response */
interface TransactionPagination {
  before: string | null;
  hasMore: boolean;
}

/** Union type for transaction responses (legacy or versioned) */
export type AnyTransactionResponse =
  | TransactionResponse
  | VersionedTransactionResponse
  | null;

/** Response structure for getTransactions */
export interface GetTransactionsResponse {
  transactions: AnyTransactionResponse[];
  pagination: TransactionPagination;
}
