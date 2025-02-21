// src/agent.ts
import { SolanaAgentKit, createSolanaTools } from "solana-agent-kit";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { StructuredTool } from "@langchain/core/tools";
import * as dotenv from "dotenv";

dotenv.config();

export async function initializeAgent(tools?: StructuredTool[]) {
  const llm = new ChatOpenAI({
    modelName: "gpt-4o", // This model has a larger context window
    temperature: 0.7,
    maxTokens: 1500, // Limit token generation to reduce context usage
  });

  // If tools are not provided, create a minimal set
  if (!tools) {
    const solanaKit = new SolanaAgentKit(
      process.env.SOLANA_PRIVATE_KEY!,
      process.env.RPC_URL!,
      {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY!
      }
    );
    tools = createSolanaTools(solanaKit).slice(0, 5); // Limit to just a few core tools
  }
  
  const memory = new MemorySaver();

  return createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
  });
}