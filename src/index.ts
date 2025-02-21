// src/index.ts
import { HumanMessage } from "@langchain/core/messages";
import { initializeAgent } from "./agent";
import { OKXDexTool } from "./okx-dex-tool";
import { SolanaAgentKit } from "solana-agent-kit";
import * as readline from 'readline';
import * as dotenv from "dotenv";

dotenv.config();

async function runSwapConversation() {
  // Create a SolanaAgentKit instance for our custom tool
  const solanaKit = new SolanaAgentKit(
    process.env.SOLANA_PRIVATE_KEY!,
    process.env.RPC_URL!,
    {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!
    }
  );
  
  // Create the custom OKXDexTool
  const okxDexTool = new OKXDexTool(solanaKit);
  
  // Initialize the agent with our custom tool
  const agent = await initializeAgent([okxDexTool]);
  
  const config = { configurable: { thread_id: "Solana Agent Kit!" } };

  // Step 1: Get the quote
  console.log("Getting quote...");
  const quoteStream = await agent.stream({
    messages: [new HumanMessage("Get me a quote for swapping 0.001 SOL to USDC")]
  }, config);

  for await (const chunk of quoteStream) {
    if ("agent" in chunk) {
      console.log(chunk.agent.messages[0].content);
    } else if ("tools" in chunk) {
      console.log(chunk.tools.messages[0].content);
    }
    console.log("-------------------");
  }

  // Step 2: Get user confirmation
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const userConfirmed = await new Promise<boolean>((resolve) => {
    rl.question('Do you want to proceed with this swap? (yes/no): ', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
  
  if (userConfirmed) {
    // Step 3: Execute the swap
    console.log("Executing swap...");
    const swapStream = await agent.stream({
      messages: [new HumanMessage("Confirm swap")]
    }, config);

    for await (const chunk of swapStream) {
      if ("agent" in chunk) {
        console.log(chunk.agent.messages[0].content);
      } else if ("tools" in chunk) {
        console.log(chunk.tools.messages[0].content);
      }
      console.log("-------------------");
    }
  } else {
    console.log("Swap cancelled by user.");
  }
}

async function runChat() {
  // Create a SolanaAgentKit instance for our custom tool
  const solanaKit = new SolanaAgentKit(
    process.env.SOLANA_PRIVATE_KEY!,
    process.env.RPC_URL!,
    {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!
    }
  );
  
  // Create the custom OKXDexTool
  const okxDexTool = new OKXDexTool(solanaKit);
  
  // Initialize the agent with our custom tool
  const agent = await initializeAgent([okxDexTool]);
  
  const config = { configurable: { thread_id: "Solana Agent Kit!" } };

  // Example: Send a command to the agent
  const stream = await agent.stream({
    messages: [new HumanMessage('List all tokens available on OKX DEX for Solana. Use this JSON: {"operation":"getAllTokens"}')]
  }, config);

  
  // Handle the response
  for await (const chunk of stream) {
    if ("agent" in chunk) {
      console.log(chunk.agent.messages[0].content);
    } else if ("tools" in chunk) {
      console.log(chunk.tools.messages[0].content);
    }
    console.log("-------------------");
  }
}

const mode = process.argv[2] || 'chat';
if (mode === 'swap') {
  runSwapConversation().catch(console.error);
} else {
  runChat().catch(console.error);
}

// Example Messages:
// List all tokens available on OKX DEX for Solana. Use this JSON: {"operation": "getAllTokens"}
// What liquidity sources are available on OKX DEX for Solana? Use this JSON: {"operation": "getLiquidity"}
// What is the Chain info regarding Solana via OKX DEX API? Use this JSON: {"operation": "getSupportedChains"}
// 'Get me a quote for swapping SOL to USDC. Use this JSON: {"operation": "getQuote", "params": {"fromTokenAddress": "So11111111111111111111111111111111111111112", "toTokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "amount": "1000000000", "slippage": "0.1"}}')]
// Execute a swap of .001 SOL to USDC. Use this JSON: {"operation": "executeSwap", "params": {"fromTokenAddress": "So11111111111111111111111111111111111111112", "toTokenAddress": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "amount": "10000000", "slippage": "0.1"}}')]

