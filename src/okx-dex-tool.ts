// src/okx-dex-tool.ts
import { Tool } from "@langchain/core/tools";
import { SolanaAgentKit } from "solana-agent-kit";
import { OKXDexClient } from '@okx-dex/okx-dex-sdk';
import * as dotenv from "dotenv";

dotenv.config();

// Initialize the OKX DEX client once
const dexClient = new OKXDexClient({
  apiKey: process.env.OKX_API_KEY!,
  secretKey: process.env.OKX_SECRET_KEY!,
  apiPassphrase: process.env.OKX_API_PASSPHRASE!,
  projectId: process.env.OKX_PROJECT_ID!,
  solana: {
    connection: {
      rpcUrl: process.env.RPC_URL!,
      confirmTransactionInitialTimeout: 60000
    },
    privateKey: process.env.SOLANA_PRIVATE_KEY!,
    walletAddress: process.env.SOLANA_WALLET_ADDRESS!
  }
});

// Token address mapping for common tokens
const TOKEN_ADDRESSES: Record<string, string> = {
  "sol": "11111111111111111111111111111111",
  "usdc": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
};

export class OKXDexTool extends Tool {
  name = "okx_dex_tool";
  description = "Access OKX DEX for Solana operations like getting quotes, token information, and executing swaps.";

  private lastQuote: any = null; // Add this line to store the last quote

  constructor(private solanaKit: SolanaAgentKit) {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      // First try to parse as JSON
      try {
        const { operation, params } = JSON.parse(input);
        return await this.processOperation(operation, params);
      } catch (jsonError) {
        // Not valid JSON, process as natural language
        return await this.processNaturalLanguage(input);
      }
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message || "Unknown error occurred"
      });
    }
  }

  private async processOperation(operation: string, params?: any): Promise<string> {
    if (!operation) {
      return JSON.stringify({
        status: "error",
        message: "Missing operation parameter. Available operations: getQuote, getAllTokens, getLiquidity, getSupportedChains, executeSwap."
      });
    }

    switch (operation) {
      case "getQuote":
        return await this.handleGetQuote(params);
      case "getAllTokens":
        return await this.handleGetAllTokens();
      case "getLiquidity":
        return await this.handleGetLiquidity();
      case "getSupportedChains":
        return await this.handleGetSupportedChains();
      case "executeSwap":
        return await this.handleExecuteSwap(params);
      default:
        return JSON.stringify({
          status: "error",
          message: `Unknown operation: ${operation}. Available operations: getQuote, getAllTokens, getLiquidity, getSupportedChains, executeSwap.`
        });
    }
  }

  private async processNaturalLanguage(input: string): Promise<string> {
    input = input.toLowerCase();

    // Check for confirmation
    if (input.includes("confirm") && (input.includes("swap") || input.includes("transaction"))) {
      return await this.handleConfirmSwap();
    }

    // Check for token query
    if (input.includes("token") || input.includes("list token") || input.includes("available token")) {
      return await this.handleGetAllTokens();
    }

    // Check for liquidity query
    if (input.includes("liquidity") || input.includes("sources")) {
      return await this.handleGetLiquidity();
    }

    // Check for chain query
    if (input.includes("chain") || input.includes("supported chain") || input.includes("network")) {
      return await this.handleGetSupportedChains();
    }

    // Check for swap execution (vs just a quote)
    const swapMatch = input.match(/(?:swap|exchange|execute\s+swap|send|transfer)\s+(?:for\s+)?(\d+(\.\d+)?)\s+([a-zA-Z]+)\s+(?:to|into|for)\s+([a-zA-Z]+)/i);
    if (swapMatch && (input.includes("execute") || input.includes("swap") || input.includes("send") || input.includes("transfer"))) {
      const amount = swapMatch[1];
      const fromToken = swapMatch[3].toLowerCase();
      const toToken = swapMatch[4].toLowerCase();

      const fromTokenAddress = TOKEN_ADDRESSES[fromToken];
      const toTokenAddress = TOKEN_ADDRESSES[toToken];

      if (!fromTokenAddress || !toTokenAddress) {
        return JSON.stringify({
          status: "error",
          message: `Could not find address for one of the tokens: ${fromToken}, ${toToken}. Available tokens: ${Object.keys(TOKEN_ADDRESSES).join(", ")}`
        });
      }

      // Convert amount to token base units
      let baseUnits;
      if (fromToken === "sol") {
        baseUnits = (parseFloat(amount) * 1e9).toString();
      } else {
        baseUnits = (parseFloat(amount) * 1e6).toString();
      }

      return await this.handleExecuteSwap({
        fromTokenAddress,
        toTokenAddress,
        amount: baseUnits,
        autoSlippage: true,
        maxAutoSlippageBps: '100'
      });
    }

    // Check for quote query (this comes after swap execution check)
    const quoteMatch = input.match(/(?:quote|price)\s+(?:for\s+)?(\d+(\.\d+)?)\s+([a-zA-Z]+)\s+(?:to|into|for)\s+([a-zA-Z]+)/i);
    if (quoteMatch) {
      const amount = quoteMatch[1];
      const fromToken = quoteMatch[3].toLowerCase();
      const toToken = quoteMatch[4].toLowerCase();

      const fromTokenAddress = TOKEN_ADDRESSES[fromToken];
      const toTokenAddress = TOKEN_ADDRESSES[toToken];

      if (!fromTokenAddress || !toTokenAddress) {
        return JSON.stringify({
          status: "error",
          message: `Could not find address for one of the tokens: ${fromToken}, ${toToken}. Available tokens: ${Object.keys(TOKEN_ADDRESSES).join(", ")}`
        });
      }

      // Convert amount to token base units
      let baseUnits;
      if (fromToken === "sol") {
        baseUnits = (parseFloat(amount) * 1e9).toString();
      } else {
        baseUnits = (parseFloat(amount) * 1e6).toString();
      }

      return await this.handleGetQuoteAndPrep({
        fromTokenAddress,
        toTokenAddress,
        amount: baseUnits,
        slippage: "0.1"
      });
    }


    return JSON.stringify({
      status: "error",
      message: "I couldn't understand your request. You can ask about tokens, liquidity, chains, get a quote for swapping tokens, or execute a swap."
    });
  }

  // Add a new method to handle executing swaps
  private async handleExecuteSwap(params: any): Promise<string> {
    const {
      fromTokenAddress,
      toTokenAddress,
      amount,
      autoSlippage = true,
      maxAutoSlippageBps = '100',
      slippage = '0.5'
    } = params;

    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return JSON.stringify({
        status: "error",
        message: "Required parameters missing. Please provide fromTokenAddress, toTokenAddress, and amount."
      });
    }

    try {
      // First get token info for better reporting
      const quote = await dexClient.dex.getQuote({
        chainId: '501',
        fromTokenAddress,
        toTokenAddress,
        amount,
        slippage: autoSlippage ? undefined : slippage
      });

      const quoteData = quote.data[0];
      const fromAmount = parseFloat(quoteData.fromTokenAmount) / Math.pow(10, parseInt(quoteData.fromToken.decimal));
      const toAmount = parseFloat(quoteData.toTokenAmount) / Math.pow(10, parseInt(quoteData.toToken.decimal));

      // Execute the swap
      const swapResult = await dexClient.dex.executeSwap({
        chainId: '501',
        fromTokenAddress,
        toTokenAddress,
        amount,
        slippage: '.1',
        autoSlippage,
        maxAutoSlippage: maxAutoSlippageBps,
        userWalletAddress: process.env.SOLANA_WALLET_ADDRESS!
      });

      return JSON.stringify({
        status: "success",
        summary: {
          fromToken: quoteData.fromToken.tokenSymbol,
          toToken: quoteData.toToken.tokenSymbol,
          fromAmount,
          toAmount,
          exchangeRate: toAmount / fromAmount,
          txId: swapResult.transactionId,
          explorerUrl: swapResult.explorerUrl || `https://www.okx.com/web3/explorer/sol/tx/${swapResult.transactionId}`
        },
        data: swapResult
      });
    } catch (error: any) {
      console.error("Detailed swap error:", error);
      return JSON.stringify({
        status: "error",
        message: error.message || "Failed to execute swap",
        details: error.response?.data || error.stack
      });
    }
  }

  private async handleGetQuote(params: any): Promise<string> {
    const { fromTokenAddress, toTokenAddress, amount, slippage = "0.001" } = params;

    if (!fromTokenAddress || !toTokenAddress || !amount) {
      return JSON.stringify({
        status: "error",
        message: "Required parameters missing. Please provide fromTokenAddress, toTokenAddress, and amount."
      });
    }

    try {
      const quote = await dexClient.dex.getQuote({
        chainId: '501', // Solana Chain ID
        fromTokenAddress,
        toTokenAddress,
        amount,
        slippage
      });

      // Format quote result for better readability
      const quoteData = quote.data[0];
      const fromAmount = parseFloat(quoteData.fromTokenAmount) / Math.pow(10, parseInt(quoteData.fromToken.decimal));
      const toAmount = parseFloat(quoteData.toTokenAmount) / Math.pow(10, parseInt(quoteData.toToken.decimal));

      return JSON.stringify({
        status: "success",
        summary: {
          fromToken: quoteData.fromToken.tokenSymbol,
          toToken: quoteData.toToken.tokenSymbol,
          fromAmount,
          toAmount,
          exchangeRate: toAmount / fromAmount,
          priceImpact: quoteData.priceImpactPercentage || "Unknown"
        },
        data: quote
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message || "Failed to get quote"
      });
    }
  }

  private async handleGetAllTokens(): Promise<string> {
    try {
      const tokens = await dexClient.dex.getTokens('501');

      // Format the token list for better readability
      const formattedTokens = tokens.data.map((token: any) => ({
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        decimals: token.decimal
      }));

      return JSON.stringify({
        status: "success",
        summary: `Found ${formattedTokens.length} tokens on Solana via OKX DEX`,
        tokens: formattedTokens.slice(0, 10), // Include first 10 tokens in summary
        data: tokens
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message || "Failed to get tokens"
      });
    }
  }

  private async handleGetLiquidity(): Promise<string> {
    try {
      const liquidity = await dexClient.dex.getLiquidity('501');

      // Format the liquidity sources for better readability
      const sources = liquidity.data.map((source: any) => ({
        name: source.name,
        id: source.id
      }));

      return JSON.stringify({
        status: "success",
        summary: `OKX DEX aggregates ${sources.length} liquidity sources on Solana: ${sources.map(s => s.name).join(", ")}`,
        data: sources
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message || "Failed to get liquidity"
      });
    }
  }

  private async handleGetSupportedChains(): Promise<string> {
    try {
      const chains = await dexClient.dex.getSupportedChains('501');

      const chainList = chains.data.map((chain: any) => ({
        name: chain.name,
        id: chain.id,
        nativeCurrency: chain.nativeCurrency
      }));

      return JSON.stringify({
        status: "success",
        summary: `OKX DEX supports ${chainList.length} chains, including: ${chainList.map(c => c.name).join(", ")}`,
        data: chainList
      });
    } catch (error: any) {
      return JSON.stringify({
        status: "error",
        message: error.message || "Failed to get supported chains"
      });
    }
  }
  // Add these methods after your other handler methods
  private async handleGetQuoteAndPrep(params: any): Promise<string> {
    const result = await this.handleGetQuote(params);
    // Store the params and quote for later use
    this.lastQuote = {
      params,
      result: JSON.parse(result)
    };

    return JSON.stringify({
      status: "quote_ready",
      message: "Quote obtained. Reply with 'confirm swap' to execute this transaction.",
      quoteData: JSON.parse(result)
    });
  }

  private async handleConfirmSwap(): Promise<string> {
    if (!this.lastQuote) {
      return JSON.stringify({
        status: "error",
        message: "No quote has been prepared. Please get a quote first."
      });
    }

    const { params } = this.lastQuote;
    return await this.handleExecuteSwap(params);
  }
}