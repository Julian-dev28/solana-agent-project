# Solana OKX DEX Integration

A TypeScript application that integrates with OKX DEX on Solana, allowing for token swaps and market information retrieval using an AI-powered agent.

## Features

- Token swaps on OKX DEX (Solana)
- Real-time quote fetching
- Token listing information
- Liquidity source information
- Interactive CLI interface

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Solana wallet with SOL for transactions
- OKX API credentials
- OpenAI API key

## Installation

1. Clone the repository:

```bash
git clone https://github.com/julian-dev28/solana-agent-project.git
cd solana-agent-project
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file based on the `.env.example` template:

```bash
cp .env.example .env
```

4. Configure the `.env` file with your API keys and wallet details.
You can get your API keys from the [OKX Developer Portal](https://www.okx.com/web3/build/dev-portal).
You can get your RPC URL from the [Helius Dashboard Portal](https://dashboard.helius.dev/).

5. Run the application:

Edit the message in the `src/index.ts` file to test the different methods.

You can run the application in chat mode or swap mode.

Chat mode will will allow you to retrieve information such as token listings, liquidity sources, and chain information.

Swap mode will allow you to swap tokens on OKX DEX.



example usage:

```bash
npm start
```

```bash
npm start swap
```

## Security

- Never commit your `.env` file
- Keep your private keys and API credentials secure
- Use appropriate slippage values to prevent unfavorable trades

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please open an issue in the repository.