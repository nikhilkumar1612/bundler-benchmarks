# Bundler Benchmarks

Contains scripts to load test user operations (userops) on the Optimism network using Etherspot's free bundler.

## Prerequisites

1. Node.js installed on your system
2. A `.env` file with the following environment variables:
   - `PRIVATE_KEY`: Your private key for the owner account
   - `BUNDLER_URL`: The etherspot bundler URL endpoint for given chain for ep8
   - `NUMBER_OF_ACCOUNTS`: Number of accounts to create (for setupAccounts type)
   - `ACCOUNTS`: Comma-separated list of private keys (for measureReceipt and measureP2pPropagation types)

## Installation

```bash
npm install
```

## Usage

The script supports three different types of operations. You can modify the last line in `index.ts` to change the operation type:

### 1. setupAccounts

Creates and funds multiple accounts for testing purposes.

**Configuration:**
- Set `NUMBER_OF_ACCOUNTS` in your `.env` file to specify how many accounts to create
- Ensure `PRIVATE_KEY` is set to your owner account private key

**To run:**
```bash
# Modify index.ts line 188 to: main(optimism, "setupAccounts");
npx tsx index.ts
```

**What it does:**
- Generates the specified number of private keys and accounts
- Saves account details to a timestamped output file
- Funds each account with 0.0001 ETH using the owner account
- Uses batch transactions (5 accounts per batch) for efficiency

### 2. measureReceipt

Measures the time it takes for user operations to be included in a block after being submitted to the mempool.

**Configuration:**
- Set `ACCOUNTS` in your `.env` file with comma-separated private keys
- Ensure `BUNDLER_URL` is set

**To run:**
```bash
# Modify index.ts line 188 to: main(optimism, "measureReceipt");
npx tsx index.ts
```

**What it does:**
- Sends a user operation from each account
- Measures time from submission to receipt confirmation
- Times out after 60 seconds if no receipt is received
- Logs detailed timing information for each operation

### 3. measureP2pPropagation

Measures the time it takes for user operations to propagate to other nodes in the network.

**Configuration:**
- Set `ACCOUNTS` in your `.env` file with comma-separated private keys
- Ensure `BUNDLER_URL` is set

**To run:**
```bash
# Modify index.ts line 188 to: main(optimism, "measureP2pPropagation");
npx tsx index.ts
```

**What it does:**
- Sends a user operation from each account
- Measures time for P2P propagation across the network
- Times out after 60 seconds if propagation doesn't complete
- Logs timing information for network propagation

## Environment Variables

Create a `.env` file in the project root with:

```env
PRIVATE_KEY=your_private_key_here
BUNDLER_URL=your_bundler_url_here
NUMBER_OF_ACCOUNTS=10
ACCOUNTS=private_key_1,private_key_2,private_key_3
```

## Output

- **setupAccounts**: Creates a timestamped output file (`output_[timestamp].txt`) containing private key and address pairs
- **measureReceipt**: Logs timing information to console for each user operation
- **measureP2pPropagation**: Logs P2P propagation timing to console for each user operation

