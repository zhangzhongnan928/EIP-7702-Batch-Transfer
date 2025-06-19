# ERC20 Batch Transfer DApp

A decentralized application that allows MetaMask Smart Account users to transfer all their ERC20 tokens to another wallet in a single atomic transaction using EIP-5792 batch transaction capabilities.

🚀 **[Live Demo](https://eip-7702-batch-transfer.vercel.app)** | 📚 **[Documentation](#usage-instructions)** | 🛠️ **[Deploy Your Own](#deployment)**

## Features

- **🚀 One-Click Batch Transfer**: Transfer all ERC20 tokens in a single atomic transaction
- **⚡ Gas Efficient**: Save on gas fees by bundling multiple transfers
- **🔒 Atomic Execution**: All transfers succeed or fail together
- **🎯 Smart Account Integration**: Leverages MetaMask Smart Account capabilities
- **📱 Responsive Design**: Works on desktop and mobile devices
- **🔍 Token Detection**: Automatically detects ERC20 tokens in your wallet

## Requirements

- **MetaMask Browser Extension** with Smart Account support
- **Supported Networks**: Ethereum Mainnet, Sepolia, Gnosis, BNB Smart Chain, OP Mainnet, Base
- **EIP-5792 Support**: Your MetaMask wallet must support batch transactions

## Supported Networks

According to the [MetaMask documentation](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/), the following networks currently support atomic batch transactions:

- Ethereum Mainnet and Sepolia
- Gnosis Mainnet and Chiado  
- BNB Smart Chain Mainnet and Testnet
- OP Mainnet
- Base Mainnet and Sepolia

## How It Works

The application uses three key EIP-5792 methods:

1. **`wallet_getCapabilities`** - Checks if atomic batch transactions are supported
2. **`wallet_sendCalls`** - Submits multiple transactions as a single atomic batch
3. **`wallet_getCallsStatus`** - Tracks the status of the batch transaction

## Usage Instructions

### 1. Setup
1. Open the `index.html` file in a web browser
2. Ensure MetaMask is installed and configured

### 2. Connect Wallet
1. Click "Connect MetaMask" to connect your wallet
2. The app will check if your account supports atomic batch transactions
3. If your account is not a Smart Account, MetaMask may prompt you to upgrade

### 3. Scan for Tokens
1. Click "Scan ERC20 Tokens" to detect tokens in your wallet
2. The app will search for common ERC20 tokens with non-zero balances
3. Detected tokens will be displayed with their current balances

### 4. Execute Batch Transfer
1. Enter the recipient wallet address
2. Click "Execute Batch Transfer"
3. MetaMask will prompt you to confirm the batch transaction
4. The app will track and display the transaction status

## Security Considerations

- **Input Validation**: All addresses are validated before processing
- **Error Handling**: Comprehensive error handling for various failure scenarios
- **Transaction Verification**: Status tracking ensures transaction completion
- **No Private Key Storage**: Application never handles or stores private keys

## Technical Implementation

### Core Technologies
- **Frontend**: Pure HTML, CSS, and JavaScript (no frameworks required)
- **Blockchain Integration**: MetaMask Ethereum Provider API
- **Transaction Batching**: EIP-5792 specification

### Key Components

#### Token Detection
```javascript
// ERC20 balanceOf function call
const data = '0x70a08231' + userAddress.slice(2).padStart(64, '0');
const result = await provider.request({
    method: 'eth_call',
    params: [{ to: tokenAddress, data: data }, 'latest']
});
```

#### Batch Transaction Creation
```javascript
const calls = tokens.map(token => ({
    to: token.address,
    value: '0x0',
    data: '0xa9059cbb' + recipientAddress.slice(2).padStart(64, '0') + 
          token.balance.toString(16).padStart(64, '0')
}));
```

#### Atomic Batch Submission
```javascript
const result = await provider.request({
    method: 'wallet_sendCalls',
    params: [{
        version: '2.0.0',
        from: userAccount,
        chainId: chainId,
        atomicRequired: true,
        calls: calls
    }]
});
```

## Error Handling

The application handles various error scenarios:

- **MetaMask Not Installed**: Clear instructions to install MetaMask
- **Unsupported Network**: Warning about network compatibility
- **Account Upgrade Required**: Guidance for Smart Account upgrade
- **Transaction Rejection**: User-friendly message for rejected transactions
- **Invalid Addresses**: Address format validation
- **No Tokens Found**: Informative message when no tokens are detected

## Limitations

- **Token Detection**: Currently scans a predefined list of common tokens
- **Network Support**: Limited to EIP-5792 compatible networks
- **Smart Account Requirement**: Requires MetaMask Smart Account for full functionality
- **Gas Estimation**: No pre-transaction gas estimation displayed

## Future Enhancements

- **Enhanced Token Detection**: Integration with token registry APIs
- **Gas Estimation**: Pre-transaction gas cost estimation
- **Transaction History**: Local storage of past batch transfers
- **Custom Token Addition**: Manual token address input
- **Partial Transfer Options**: Select specific tokens for transfer
- **Multi-Recipient Support**: Distribute tokens to multiple addresses

## Testing

To test the application:

1. Use a testnet like Sepolia for safe testing
2. Ensure you have test ERC20 tokens in your wallet
3. Test with a small number of tokens first
4. Verify transactions on block explorer

## Resources

- [MetaMask Batch Transactions Documentation](https://docs.metamask.io/wallet/how-to/send-transactions/send-batch-transactions/)
- [EIP-5792: Wallet Function Call API](https://eips.ethereum.org/EIPS/eip-5792)
- [EIP-7702: Set EOA account code](https://eips.ethereum.org/EIPS/eip-7702)
- [MetaMask Smart Accounts](https://docs.metamask.io/delegation-toolkit/)

## Deployment

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zhangzhongnan928/EIP-7702-Batch-Transfer)

### Manual Deployment

#### Deploy to Vercel
1. Fork this repository
2. Connect your GitHub account to [Vercel](https://vercel.com)
3. Import your forked repository
4. Deploy automatically - no configuration needed!

#### Deploy to Netlify
1. Fork this repository
2. Connect to [Netlify](https://netlify.com)
3. Deploy from Git - automatic detection of static site

#### Deploy to GitHub Pages
1. Go to repository Settings → Pages
2. Select "Deploy from a branch"
3. Choose `main` branch and `/ (root)` folder
4. Your site will be available at `https://yourusername.github.io/EIP-7702-Batch-Transfer`

### Local Development

```bash
# Clone the repository
git clone https://github.com/zhangzhongnan928/EIP-7702-Batch-Transfer.git
cd EIP-7702-Batch-Transfer

# Start local server (choose one method)
# Method 1: Python
python3 -m http.server 8000

# Method 2: Node.js
npx serve -s . -l 8000

# Method 3: Live reload
npm install -g live-server
live-server --port=8000

# Open http://localhost:8000
```

## Technical Stack

- **Frontend**: Pure HTML5, CSS3, JavaScript (ES6+)
- **Blockchain**: Ethereum, Polygon, BSC, Optimism, Base, Arbitrum
- **Wallet**: MetaMask with Smart Account support
- **Standards**: EIP-5792 (Batch Transactions), EIP-7702 (Smart Accounts)
- **Deployment**: Vercel, Netlify, GitHub Pages compatible

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License. 