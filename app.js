class ERC20BatchTransfer {
    constructor() {
        this.provider = null;
        this.userAccount = null;
        this.chainId = null;
        this.detectedTokens = [];
        this.customTokens = [];
        this.batchId = null;
        
        // Uniswap token lists for different networks
        this.tokenLists = {};
        this.loadingTokenLists = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkMetaMaskConnection();
        this.loadUniswapTokenLists();
    }

    setupEventListeners() {
        document.getElementById('connectBtn').addEventListener('click', () => this.connectWallet());
        document.getElementById('scanTokensBtn').addEventListener('click', () => this.scanTokens());
        document.getElementById('testSingleTransferBtn').addEventListener('click', () => this.testSingleTransfer());
        document.getElementById('checkBatchSupportBtn').addEventListener('click', () => this.checkDetailedBatchSupport());
        document.getElementById('executeTraditionalBtn').addEventListener('click', () => this.executeTraditionalTransfers());
        document.getElementById('batchTransferBtn').addEventListener('click', () => this.executeBatchTransfer());
        document.getElementById('addTokenBtn').addEventListener('click', () => this.addCustomToken());
        
        // Listen for account changes
        if (window.ethereum) {
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this.handleDisconnect();
                } else {
                    this.userAccount = accounts[0];
                    this.updateWalletInfo();
                }
            });
            
            window.ethereum.on('chainChanged', (chainId) => {
                this.chainId = chainId;
                this.checkBatchSupport();
            });
        }
    }

    async checkMetaMaskConnection() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    this.provider = window.ethereum;
                    this.userAccount = accounts[0];
                    this.chainId = await window.ethereum.request({ method: 'eth_chainId' });
                    this.updateConnectedState();
                }
            } catch (error) {
                console.error('Error checking MetaMask connection:', error);
            }
        } else {
            this.showStatus('MetaMask is not installed. Please install MetaMask to use this app.', 'error');
        }
    }

    async connectWallet() {
        if (typeof window.ethereum === 'undefined') {
            this.showStatus('MetaMask is not installed. Please install MetaMask to continue.', 'error');
            return;
        }

        try {
            this.setButtonLoading('connectBtn', true);
            
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.provider = window.ethereum;
            this.userAccount = accounts[0];
            this.chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            this.updateConnectedState();
            this.showStatus('Wallet connected successfully!', 'success');
            
        } catch (error) {
            console.error('Error connecting wallet:', error);
            this.showStatus('Failed to connect wallet. Please try again.', 'error');
        } finally {
            this.setButtonLoading('connectBtn', false);
        }
    }

    updateConnectedState() {
        this.updateWalletInfo();
        this.checkBatchSupport();
        
        document.getElementById('connectBtn').textContent = 'Connected ✓';
        document.getElementById('connectBtn').disabled = true;
        document.getElementById('scanTokensBtn').disabled = false;
        
        // Load token lists if not already loaded
        if (Object.keys(this.tokenLists).length === 0 && !this.loadingTokenLists) {
            this.loadUniswapTokenLists();
        }
    }

    updateWalletInfo() {
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        
        walletAddress.textContent = this.userAccount;
        walletInfo.style.display = 'block';
    }

    async checkBatchSupport() {
        try {
            const capabilities = await this.provider.request({
                method: 'wallet_getCapabilities',
                params: [this.userAccount, [this.chainId]]
            });

            const chainCapabilities = capabilities[this.chainId];
            if (chainCapabilities && chainCapabilities.atomic) {
                const status = chainCapabilities.atomic.status;
                if (status === 'ready' || status === 'supported') {
                    this.showStatus(`Atomic batch transactions ${status} on this network!`, 'success');
                } else {
                    this.showStatus('Atomic batch transactions not supported on this network.', 'warning');
                }
            } else {
                this.showStatus('Atomic batch transactions not available on this network.', 'warning');
            }
        } catch (error) {
            console.error('Error checking batch support:', error);
            this.showStatus('Could not verify batch transaction support.', 'warning');
        }
    }

    async scanTokens() {
        if (!this.userAccount) {
            this.showStatus('Please connect your wallet first.', 'error');
            return;
        }

        try {
            this.setButtonLoading('scanTokensBtn', true);
            this.detectedTokens = [];
            
            this.showStatus(`Scanning for ERC20 tokens on ${this.getNetworkName(this.chainId)}...`, 'info');
            console.log('Current network:', this.chainId);
            console.log('Available token lists:', Object.keys(this.tokenLists));
            
            // Get tokens from common token list and custom tokens
            await this.detectCommonTokens();
            await this.detectCustomTokens();
            
            if (this.detectedTokens.length > 0) {
                this.displayTokens();
                document.getElementById('testSingleTransferBtn').disabled = false;
                document.getElementById('checkBatchSupportBtn').disabled = false;
                document.getElementById('executeTraditionalBtn').disabled = false;
                document.getElementById('batchTransferBtn').disabled = false;
                this.showStatus(`Found ${this.detectedTokens.length} ERC20 tokens with balances.`, 'success');
            } else {
                const networkName = this.getNetworkName(this.chainId);
                this.showStatus(`No ERC20 tokens with balances found on ${networkName}. Try adding custom token addresses.`, 'warning');
            }
            
        } catch (error) {
            console.error('Error scanning tokens:', error);
            this.showStatus('Error scanning for tokens. Please try again.', 'error');
        } finally {
            this.setButtonLoading('scanTokensBtn', false);
        }
    }

    async loadUniswapTokenLists() {
        if (this.loadingTokenLists) return;
        this.loadingTokenLists = true;
        
        try {
            console.log('Loading Uniswap token lists...');
            
            // Network chain ID to Uniswap file mapping
            const networkFiles = {
                '0x1': 'mainnet',
                '0x38': 'bsc',
                '0x89': 'polygon',
                '0xa': 'optimism',
                '0x2105': 'base',
                '0xa4b1': 'arbitrum',
                '0xaa36a7': 'sepolia'
            };
            
            // Load token lists for available networks
            for (const [chainId, networkName] of Object.entries(networkFiles)) {
                try {
                    const response = await fetch(`https://raw.githubusercontent.com/Uniswap/default-token-list/main/src/tokens/${networkName}.json`);
                    if (response.ok) {
                        const tokens = await response.json();
                        this.tokenLists[chainId] = tokens;
                        console.log(`Loaded ${tokens.length} tokens for ${networkName} (${chainId})`);
                    }
                } catch (error) {
                    console.warn(`Failed to load tokens for ${networkName}:`, error.message);
                }
            }
            
            this.showStatus(`Loaded token lists for ${Object.keys(this.tokenLists).length} networks`, 'info');
            
        } catch (error) {
            console.error('Error loading Uniswap token lists:', error);
            this.showStatus('Using fallback token detection', 'warning');
        } finally {
            this.loadingTokenLists = false;
        }
    }

    async detectCommonTokens() {
        const chainIdInt = parseInt(this.chainId, 16);
        const networkTokens = this.tokenLists[this.chainId] || [];
        
        console.log(`Checking ${networkTokens.length} tokens for network ${this.chainId}`);
        
        // Prioritize popular tokens by checking them first
        const popularTokens = networkTokens.filter(token => 
            ['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE'].includes(token.symbol)
        );
        
        const otherTokens = networkTokens.filter(token => 
            !['USDC', 'USDT', 'DAI', 'WETH', 'WBTC', 'UNI', 'LINK', 'AAVE'].includes(token.symbol)
        );
        
        // Check popular tokens first, then a sample of others
        const tokensToCheck = [...popularTokens, ...otherTokens.slice(0, 50)];
        
        for (const token of tokensToCheck) {
            try {
                if (token.chainId === chainIdInt) {
                    const balance = await this.getTokenBalance(token.address, this.userAccount);
                    if (balance > 0) {
                        this.detectedTokens.push({
                            name: token.name,
                            symbol: token.symbol,
                            decimals: token.decimals,
                            address: token.address,
                            balance,
                            logoURI: token.logoURI
                        });
                    }
                }
            } catch (error) {
                console.warn(`Failed to check token ${token.symbol}:`, error);
            }
        }
    }

    async detectCustomTokens() {
        for (const tokenAddress of this.customTokens) {
            try {
                const balance = await this.getTokenBalance(tokenAddress, this.userAccount);
                if (balance > 0) {
                    const tokenInfo = await this.getTokenInfo(tokenAddress);
                    this.detectedTokens.push({
                        ...tokenInfo,
                        address: tokenAddress,
                        balance,
                        isCustom: true
                    });
                }
            } catch (error) {
                console.warn(`Failed to check custom token ${tokenAddress}:`, error);
            }
        }
    }

    async addCustomToken() {
        const tokenAddress = document.getElementById('customTokenAddress').value.trim();
        
        if (!this.validateAddress(tokenAddress)) {
            this.showStatus('Please enter a valid token contract address.', 'error');
            return;
        }

        if (this.customTokens.includes(tokenAddress)) {
            this.showStatus('Token already added.', 'warning');
            return;
        }

        try {
            this.showStatus('Adding custom token...', 'info');
            
            // Verify it's a valid ERC20 token by checking if it has the required functions
            const tokenInfo = await this.getTokenInfo(tokenAddress);
            
            if (tokenInfo.symbol === 'Unknown') {
                this.showStatus('Invalid ERC20 token address or network error.', 'error');
                return;
            }

            this.customTokens.push(tokenAddress);
            document.getElementById('customTokenAddress').value = '';
            
            this.showStatus(`Added ${tokenInfo.symbol} token. Click "Scan ERC20 Tokens" to refresh.`, 'success');
            
        } catch (error) {
            console.error('Error adding custom token:', error);
            this.showStatus('Failed to add token. Please check the address.', 'error');
        }
    }

    getNetworkName(chainId) {
        const networks = {
            '0x1': 'Ethereum Mainnet',
            '0xaa36a7': 'Sepolia Testnet', 
            '0x89': 'Polygon Mainnet',
            '0x38': 'BSC Mainnet',
            '0xa': 'Optimism Mainnet',
            '0x2105': 'Base Mainnet',
            '0xa4b1': 'Arbitrum Mainnet',
            '0x144': 'ZKSync Era Mainnet',
            '0x8274f': 'Scroll Mainnet'
        };
        return networks[chainId] || `Network (${chainId})`;
    }

    async getTokenBalance(tokenAddress, userAddress) {
        try {
            // ERC20 balanceOf function signature
            const data = '0x70a08231' + userAddress.slice(2).padStart(64, '0');
            
            const result = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: data
                }, 'latest']
            });
            
            return parseInt(result, 16);
        } catch (error) {
            console.error('Error getting token balance:', error);
            return 0;
        }
    }

    async getTokenInfo(tokenAddress) {
        try {
            // Get token name
            const nameData = '0x06fdde03'; // name() function signature
            const nameResult = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: nameData
                }, 'latest']
            });
            
            // Get token symbol
            const symbolData = '0x95d89b41'; // symbol() function signature
            const symbolResult = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: symbolData
                }, 'latest']
            });
            
            // Get token decimals
            const decimalsData = '0x313ce567'; // decimals() function signature
            const decimalsResult = await this.provider.request({
                method: 'eth_call',
                params: [{
                    to: tokenAddress,
                    data: decimalsData
                }, 'latest']
            });
            
            return {
                name: this.parseStringResult(nameResult),
                symbol: this.parseStringResult(symbolResult),
                decimals: parseInt(decimalsResult, 16)
            };
        } catch (error) {
            console.error('Error getting token info:', error);
            return {
                name: 'Unknown Token',
                symbol: 'UNK',
                decimals: 18
            };
        }
    }

    parseStringResult(hexResult) {
        try {
            // Remove 0x prefix and decode hex to string
            const hex = hexResult.slice(2);
            let str = '';
            for (let i = 0; i < hex.length; i += 2) {
                const byte = parseInt(hex.substr(i, 2), 16);
                if (byte !== 0) {
                    str += String.fromCharCode(byte);
                }
            }
            return str.replace(/\0/g, '').trim();
        } catch (error) {
            return 'Unknown';
        }
    }

    displayTokens() {
        const tokensContainer = document.getElementById('tokensContainer');
        const tokensList = document.getElementById('tokensList');
        
        tokensContainer.innerHTML = '';
        
        this.detectedTokens.forEach(token => {
            const tokenElement = document.createElement('div');
            tokenElement.className = 'token-item';
            
            const balance = (token.balance / Math.pow(10, token.decimals)).toFixed(6);
            const customBadge = token.isCustom ? ' <span style="background: #667eea; color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px;">CUSTOM</span>' : '';
            const logoImg = token.logoURI ? `<img src="${token.logoURI}" alt="${token.symbol}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;" onerror="this.style.display='none'">` : '';
            
            tokenElement.innerHTML = `
                <div class="token-info" style="display: flex; align-items: center;">
                    ${logoImg}
                    <div style="flex: 1;">
                        <div class="token-symbol">${token.symbol}${customBadge}</div>
                        <div class="token-balance">Balance: ${balance}</div>
                        <div style="font-size: 12px; color: #718096; font-family: monospace;">${token.address}</div>
                    </div>
                </div>
            `;
            
            tokensContainer.appendChild(tokenElement);
        });
        
        tokensList.style.display = 'block';
    }

    async testSingleTransfer() {
        const recipientAddress = document.getElementById('recipientAddress').value.trim();
        
        if (!this.validateAddress(recipientAddress)) {
            this.showStatus('Please enter a valid recipient address.', 'error');
            return;
        }
        
        if (this.detectedTokens.length === 0) {
            this.showStatus('No tokens to transfer. Please scan for tokens first.', 'error');
            return;
        }

        try {
            this.setButtonLoading('testSingleTransferBtn', true);
            this.showStatus('测试单个代币转账... / Testing single token transfer...', 'info');
            
            // Use the first detected token for testing
            const testToken = this.detectedTokens[0];
            console.log('Testing with token:', testToken);
            
            // Create a small amount for testing (1% of balance or minimum)
            const testAmount = Math.max(1, Math.floor(testToken.balance * 0.01));
            
            const recipient = recipientAddress.slice(2).toLowerCase().padStart(64, '0');
            const amount = testAmount.toString(16).padStart(64, '0');
            const transferData = '0xa9059cbb' + recipient + amount;
            
            console.log(`测试转账数据: ${transferData}`);
            
            // Try regular transaction first
            const txHash = await this.provider.request({
                method: 'eth_sendTransaction',
                params: [{
                    from: this.userAccount,
                    to: testToken.address,
                    data: transferData,
                    gas: '0x15f90' // Gas is needed for regular transactions
                }]
            });
            
            this.showStatus(`测试转账已提交! 交易哈希: ${txHash} / Test transfer submitted! TX: ${txHash}`, 'success');
            
        } catch (error) {
            console.error('Single transfer test failed:', error);
            this.showStatus(`单个转账测试失败: ${error.message} / Single transfer test failed: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('testSingleTransferBtn', false);
        }
    }

    async executeBatchTransfer() {
        const recipientAddress = document.getElementById('recipientAddress').value.trim();
        
        if (!this.validateAddress(recipientAddress)) {
            this.showStatus('Please enter a valid recipient address.', 'error');
            return;
        }
        
        if (this.detectedTokens.length === 0) {
            this.showStatus('No tokens to transfer. Please scan for tokens first.', 'error');
            return;
        }

        try {
            this.setButtonLoading('batchTransferBtn', true);
            this.showStatus('准备批量转账交易... / Preparing batch transfer transaction...', 'info');
            
            // Pre-flight checks
            const preflightResult = await this.performPreflightChecks();
            if (!preflightResult.success) {
                this.showStatus(preflightResult.error, 'error');
                return;
            }
            
            // Validate required parameters
            if (!this.userAccount || !this.chainId) {
                this.showStatus('钱包信息不完整，请重新连接 / Wallet information incomplete, please reconnect', 'error');
                return;
            }
            
            console.log('批量交易参数验证:', {
                userAccount: this.userAccount,
                chainId: this.chainId,
                tokenCount: this.detectedTokens.length
            });
            
            // Create batch transfer calls with proper encoding
            const calls = [];
            
            for (const token of this.detectedTokens) {
                try {
                    // Handle different token types and edge cases
                    let transferData;
                    
                    // Special handling for USDT and other non-standard ERC20 tokens
                    if (token.symbol === 'USDT' || token.address.toLowerCase() === '0xdac17f958d2ee523a2206206994597c13d831ec7') {
                        // USDT has different behavior, use safeTransfer approach
                        console.log(`Special handling for ${token.symbol}`);
                    }
                    
                    // Standard ERC20 transfer function: transfer(address,uint256)
                    // Function selector: 0xa9059cbb
                    const recipient = recipientAddress.slice(2).toLowerCase().padStart(64, '0');
                    const amount = token.balance.toString(16).padStart(64, '0');
                    
                    transferData = '0xa9059cbb' + recipient + amount;
                    
                    // Validate the data length
                    if (transferData.length !== 138) { // 10 + 64 + 64 = 138 characters
                        throw new Error(`Invalid data length for ${token.symbol}: ${transferData.length}`);
                    }
                    
                    console.log(`准备转账 ${token.symbol}: ${token.balance} -> ${recipientAddress}`);
                    console.log(`Transfer data: ${transferData}`);
                    
                    calls.push({
                        to: token.address.toLowerCase(),
                        value: '0x0',
                        data: transferData
                        // Note: gas is not included per EIP-5792 spec
                    });
                    
                } catch (error) {
                    console.error(`创建 ${token.symbol} 转账调用失败:`, error);
                    throw new Error(`Failed to create transfer call for ${token.symbol}: ${error.message}`);
                }
            }
            
            if (calls.length === 0) {
                throw new Error('没有有效的转账调用 / No valid transfer calls created');
            }
            
            console.log(`创建了 ${calls.length} 个转账调用 / Created ${calls.length} transfer calls`);
            
            // Submit batch transaction using wallet_sendCalls with correct format
            console.log('提交批量交易参数:', {
                version: '2.0.0',
                from: this.userAccount,
                chainId: this.chainId,
                atomicRequired: true,
                calls: calls
            });
            
            const result = await this.provider.request({
                method: 'wallet_sendCalls',
                params: [{
                    version: '2.0.0',
                    from: this.userAccount,
                    chainId: this.chainId, // Should be hex string like "0x1"
                    atomicRequired: true,  // Boolean value
                    calls: calls
                }]
            });
            
            this.batchId = result.id;
            this.showStatus('Batch transaction submitted! Tracking status...', 'info');
            
            // Start tracking transaction status
            this.trackTransactionStatus();
            
        } catch (error) {
            console.error('Error executing batch transfer:', error);
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                data: error.data
            });
            
            let errorMessage = '';
            let errorType = 'error';
            
            if (error.code === 4001) {
                errorMessage = '用户拒绝了交易 / Transaction rejected by user.';
                errorType = 'warning';
            } else if (error.code === -32602) {
                errorMessage = '不支持批量交易方法。请确保使用最新版本的MetaMask / Batch transaction method not supported. Please ensure you have the latest MetaMask version.';
            } else if (error.message.includes('atomic') || error.message.includes('wallet_sendCalls')) {
                errorMessage = '此网络不支持原子批量交易，或您的账户需要升级为智能账户。尝试使用传统方式? / Atomic batch transactions not supported on this network, or your account needs to be upgraded to a smart account. Try fallback method?';
                
                // Offer fallback option
                setTimeout(() => {
                    if (confirm('是否尝试使用传统的单独交易方式? / Would you like to try individual transactions instead?')) {
                        this.executeFallbackTransfers(recipientAddress);
                    }
                }, 1000);
            } else if (error.message.includes('insufficient funds') || error.message.includes('gas')) {
                errorMessage = '燃气费不足或余额不够 / Insufficient gas or balance for transaction.';
            } else if (error.message.includes('transfer amount exceeds balance')) {
                errorMessage = '某个代币余额不足 / One or more tokens have insufficient balance.';
            } else if (error.message.includes('network')) {
                errorMessage = '网络连接问题 / Network connectivity issue. Please try again.';
            } else {
                errorMessage = `交易失败 / Transaction failed: ${error.message}`;
            }
            
            this.showStatus(errorMessage, errorType);
            
            // Additional debugging information
            this.showTransactionDebugInfo(error);
        } finally {
            this.setButtonLoading('batchTransferBtn', false);
        }
    }

    async trackTransactionStatus() {
        if (!this.batchId) return;
        
        const maxAttempts = 60; // Wait up to 5 minutes
        let attempts = 0;
        
        const checkStatus = async () => {
            try {
                const status = await this.provider.request({
                    method: 'wallet_getCallsStatus',
                    params: [this.batchId]
                });
                
                this.updateTransactionStatus(status);
                
                if (status.status === 200) {
                    // Transaction confirmed
                    this.showTransactionSuccess(status);
                    return;
                } else if (status.status >= 400) {
                    // Transaction failed
                    this.showTransactionError(status);
                    return;
                }
                
                // Continue checking if not final status
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(checkStatus, 5000); // Check every 5 seconds
                } else {
                    this.showStatus('Transaction status check timed out. Please check manually.', 'warning');
                }
                
            } catch (error) {
                console.error('Error checking transaction status:', error);
                this.showStatus('Error tracking transaction status.', 'error');
            }
        };
        
        setTimeout(checkStatus, 2000); // Start checking after 2 seconds
    }

    updateTransactionStatus(status) {
        const statusElement = document.getElementById('transactionStatus');
        const statusText = document.getElementById('txStatusText');
        
        let message = '';
        let className = 'info';
        
        switch (status.status) {
            case 200:
                message = '✅ Batch transfer completed successfully!';
                className = 'success';
                break;
            case 100:
                message = '⏳ Transaction pending...';
                className = 'info';
                break;
            default:
                message = `📋 Transaction status: ${status.status}`;
                className = 'info';
        }
        
        statusText.textContent = message;
        statusElement.className = `status ${className}`;
        statusElement.style.display = 'block';
    }

    showTransactionSuccess(status) {
        this.showStatus('🎉 All tokens transferred successfully!', 'success');
        
        if (status.receipts && status.receipts[0]) {
            const txHash = status.receipts[0].transactionHash;
            document.getElementById('txHash').innerHTML = `
                <strong>Transaction Hash:</strong><br>
                <a href="https://etherscan.io/tx/${txHash}" target="_blank" style="color: #667eea; text-decoration: none;">
                    ${txHash}
                </a>
            `;
        }
        
        // Reset form
        this.detectedTokens = [];
        document.getElementById('tokensList').style.display = 'none';
        document.getElementById('testSingleTransferBtn').disabled = true;
        document.getElementById('batchTransferBtn').disabled = true;
        document.getElementById('recipientAddress').value = '';
    }

    async executeFallbackTransfers(recipientAddress) {
        this.showStatus('开始传统方式逐个转账... / Starting individual transfers...', 'info');
        
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < this.detectedTokens.length; i++) {
            const token = this.detectedTokens[i];
            
            try {
                this.showStatus(`转账 ${token.symbol} (${i + 1}/${this.detectedTokens.length})... / Transferring ${token.symbol} (${i + 1}/${this.detectedTokens.length})...`, 'info');
                
                const recipient = recipientAddress.slice(2).toLowerCase().padStart(64, '0');
                const amount = token.balance.toString(16).padStart(64, '0');
                const transferData = '0xa9059cbb' + recipient + amount;
                
                const txHash = await this.provider.request({
                    method: 'eth_sendTransaction',
                    params: [{
                        from: this.userAccount,
                        to: token.address,
                        data: transferData,
                        gas: '0x15f90' // Gas is needed for regular transactions
                    }]
                });
                
                console.log(`${token.symbol} 转账成功: ${txHash}`);
                successCount++;
                
                // Wait a bit between transactions to avoid nonce issues
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (error) {
                console.error(`${token.symbol} 转账失败:`, error);
                failCount++;
            }
        }
        
        this.showStatus(`传统转账完成! 成功: ${successCount}, 失败: ${failCount} / Individual transfers completed! Success: ${successCount}, Failed: ${failCount}`, successCount > 0 ? 'success' : 'error');
    }

    async checkDetailedBatchSupport() {
        try {
            this.setButtonLoading('checkBatchSupportBtn', true);
            this.showStatus('检查批量交易详细支持情况... / Checking detailed batch support...', 'info');
            
            const report = [];
            
            // Check 1: Basic capability
            try {
                const capabilities = await this.provider.request({
                    method: 'wallet_getCapabilities',
                    params: [this.userAccount, [this.chainId]]
                });
                
                const chainCapabilities = capabilities[this.chainId];
                if (chainCapabilities && chainCapabilities.atomic) {
                    report.push(`✅ 支持 wallet_getCapabilities: ${chainCapabilities.atomic.status}`);
                } else {
                    report.push(`❌ 不支持 wallet_getCapabilities 或无原子批量功能`);
                }
            } catch (error) {
                report.push(`❌ wallet_getCapabilities 失败: ${error.message}`);
            }
            
            // Check 2: Test wallet_sendCalls method existence with proper format
            try {
                await this.provider.request({
                    method: 'wallet_sendCalls',
                    params: [{ 
                        version: '2.0.0',
                        from: this.userAccount,
                        chainId: this.chainId,
                        atomicRequired: true,
                        calls: [] 
                    }] // Proper format test
                });
                report.push(`✅ wallet_sendCalls 方法和格式都正确`);
            } catch (error) {
                if (error.code === -32601) {
                    report.push(`❌ wallet_sendCalls 方法不存在 (${error.message})`);
                } else if (error.message.includes('Invalid params') || error.message.includes('Expected')) {
                    report.push(`⚠️ wallet_sendCalls 格式问题已修复: ${error.message}`);
                } else {
                    report.push(`⚠️ wallet_sendCalls 其他问题: ${error.message}`);
                }
            }
            
            // Check 3: Network info
            report.push(`🌐 当前网络: ${this.getNetworkName(this.chainId)} (${this.chainId})`);
            
            // Check 4: MetaMask version detection attempt
            try {
                const version = await this.provider.request({ method: 'web3_clientVersion' });
                report.push(`🦊 MetaMask 版本: ${version}`);
            } catch (error) {
                report.push(`⚠️ 无法检测 MetaMask 版本`);
            }
            
            // Check 5: Account type
            try {
                const code = await this.provider.request({
                    method: 'eth_getCode',
                    params: [this.userAccount, 'latest']
                });
                if (code === '0x') {
                    report.push(`👤 账户类型: EOA (外部拥有账户)`);
                } else {
                    report.push(`🤖 账户类型: 智能合约账户`);
                }
            } catch (error) {
                report.push(`⚠️ 无法检测账户类型`);
            }
            
            // Display report
            const reportHtml = `
                <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-top: 15px;">
                    <h4>批量交易支持详情 / Batch Support Details:</h4>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        ${report.map(item => `<li style="margin: 5px 0;">${item}</li>`).join('')}
                    </ul>
                </div>
            `;
            
            document.getElementById('status').innerHTML = reportHtml;
            document.getElementById('status').style.display = 'block';
            
        } catch (error) {
            console.error('Detailed check failed:', error);
            this.showStatus(`详细检查失败: ${error.message}`, 'error');
        } finally {
            this.setButtonLoading('checkBatchSupportBtn', false);
        }
    }

    async executeTraditionalTransfers() {
        const recipientAddress = document.getElementById('recipientAddress').value.trim();
        
        if (!this.validateAddress(recipientAddress)) {
            this.showStatus('Please enter a valid recipient address.', 'error');
            return;
        }
        
        if (this.detectedTokens.length === 0) {
            this.showStatus('No tokens to transfer. Please scan for tokens first.', 'error');
            return;
        }

        if (!confirm(`确定要使用传统方式逐个转账 ${this.detectedTokens.length} 个代币吗? / Are you sure you want to transfer ${this.detectedTokens.length} tokens individually?`)) {
            return;
        }

        try {
            this.setButtonLoading('executeTraditionalBtn', true);
            await this.executeFallbackTransfers(recipientAddress);
        } finally {
            this.setButtonLoading('executeTraditionalBtn', false);
        }
    }

    showTransactionError(status) {
        this.showStatus('❌ Batch transfer failed. Please try again.', 'error');
        console.error('Transaction failed with status:', status);
    }

    showTransactionDebugInfo(error) {
        const debugInfo = document.createElement('div');
        debugInfo.style.cssText = `
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
            margin-top: 10px;
            font-size: 12px;
            color: #4a5568;
        `;
        
        debugInfo.innerHTML = `
            <details>
                <summary style="cursor: pointer; font-weight: bold;">调试信息 / Debug Info</summary>
                <div style="margin-top: 10px;">
                    <strong>网络 / Network:</strong> ${this.getNetworkName(this.chainId)} (${this.chainId})<br>
                    <strong>钱包地址 / Wallet:</strong> ${this.userAccount}<br>
                    <strong>代币数量 / Token Count:</strong> ${this.detectedTokens.length}<br>
                    <strong>错误代码 / Error Code:</strong> ${error.code || 'N/A'}<br>
                    <strong>错误信息 / Error Message:</strong> ${error.message}<br>
                    <strong>支持的功能 / Capabilities:</strong> <span id="capabilitiesDebug">检查中...</span>
                </div>
            </details>
        `;
        
        const statusElement = document.getElementById('status');
        if (statusElement.nextSibling) {
            statusElement.parentNode.insertBefore(debugInfo, statusElement.nextSibling);
        } else {
            statusElement.parentNode.appendChild(debugInfo);
        }
        
        // Check capabilities for debugging
        this.checkCapabilitiesForDebug();
    }

    async checkCapabilitiesForDebug() {
        try {
            const capabilities = await this.provider.request({
                method: 'wallet_getCapabilities',
                params: [this.userAccount, [this.chainId]]
            });
            
            const capabilitiesDebug = document.getElementById('capabilitiesDebug');
            if (capabilitiesDebug) {
                const chainCapabilities = capabilities[this.chainId];
                if (chainCapabilities && chainCapabilities.atomic) {
                    capabilitiesDebug.textContent = `原子批量交易: ${chainCapabilities.atomic.status} / Atomic batch: ${chainCapabilities.atomic.status}`;
                } else {
                    capabilitiesDebug.textContent = '不支持原子批量交易 / Atomic batch not supported';
                }
            }
        } catch (error) {
            const capabilitiesDebug = document.getElementById('capabilitiesDebug');
            if (capabilitiesDebug) {
                capabilitiesDebug.textContent = '无法检查功能 / Cannot check capabilities';
            }
        }
    }

    async performPreflightChecks() {
        try {
            // Check 1: Verify capabilities
            console.log('检查批量交易支持... / Checking batch transaction support...');
            const capabilities = await this.provider.request({
                method: 'wallet_getCapabilities',
                params: [this.userAccount, [this.chainId]]
            });
            
            const chainCapabilities = capabilities[this.chainId];
            if (!chainCapabilities || !chainCapabilities.atomic) {
                return {
                    success: false,
                    error: '此网络不支持批量交易。请切换到支持的网络（如以太坊、Polygon、Base等）/ This network does not support batch transactions. Please switch to a supported network (Ethereum, Polygon, Base, etc.)'
                };
            }
            
            if (chainCapabilities.atomic.status !== 'ready' && chainCapabilities.atomic.status !== 'supported') {
                return {
                    success: false,
                    error: `批量交易状态: ${chainCapabilities.atomic.status}。可能需要升级为智能账户 / Batch transaction status: ${chainCapabilities.atomic.status}. May need to upgrade to smart account.`
                };
            }
            
            // Check 2: Verify token balances are still valid
            console.log('验证代币余额... / Verifying token balances...');
            let invalidTokens = 0;
            for (const token of this.detectedTokens) {
                try {
                    const currentBalance = await this.getTokenBalance(token.address, this.userAccount);
                    if (currentBalance <= 0) {
                        invalidTokens++;
                    }
                } catch (error) {
                    console.warn(`无法验证代币 ${token.symbol} 余额 / Cannot verify balance for token ${token.symbol}:`, error);
                    invalidTokens++;
                }
            }
            
            if (invalidTokens > 0) {
                return {
                    success: false,
                    error: `${invalidTokens} 个代币余额无效或为零。请重新扫描代币 / ${invalidTokens} tokens have invalid or zero balance. Please rescan tokens.`
                };
            }
            
            // Check 3: Estimate if wallet has enough ETH for gas
            try {
                const balance = await this.provider.request({
                    method: 'eth_getBalance',
                    params: [this.userAccount, 'latest']
                });
                const ethBalance = parseInt(balance, 16);
                if (ethBalance < 0.001 * 1e18) { // Less than 0.001 ETH
                    console.warn('ETH余额可能不足以支付燃气费 / ETH balance may be insufficient for gas fees');
                }
            } catch (error) {
                console.warn('无法检查ETH余额 / Cannot check ETH balance:', error);
            }
            
            console.log('预检查通过 / Pre-flight checks passed');
            return { success: true };
            
        } catch (error) {
            console.error('预检查失败 / Pre-flight check failed:', error);
            return {
                success: false,
                error: `预检查失败: ${error.message} / Pre-flight check failed: ${error.message}`
            };
        }
    }

    validateAddress(address) {
        return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    handleDisconnect() {
        this.provider = null;
        this.userAccount = null;
        this.chainId = null;
        this.detectedTokens = [];
        
        document.getElementById('connectBtn').textContent = 'Connect MetaMask';
        document.getElementById('connectBtn').disabled = false;
        document.getElementById('scanTokensBtn').disabled = true;
        document.getElementById('testSingleTransferBtn').disabled = true;
        document.getElementById('checkBatchSupportBtn').disabled = true;
        document.getElementById('executeTraditionalBtn').disabled = true;
        document.getElementById('batchTransferBtn').disabled = true;
        document.getElementById('walletInfo').style.display = 'none';
        document.getElementById('tokensList').style.display = 'none';
        
        this.showStatus('Wallet disconnected.', 'warning');
    }

    showStatus(message, type) {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        statusElement.className = `status ${type}`;
        statusElement.style.display = 'block';
        
        // Auto-hide success and info messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }

    setButtonLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const textSpan = button.querySelector('.button-text');
        const loadingSpan = button.querySelector('.loading-spinner');
        
        if (isLoading) {
            button.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            if (loadingSpan) loadingSpan.style.display = 'inline-block';
        } else {
            button.disabled = false;
            if (textSpan) textSpan.style.display = 'inline';
            if (loadingSpan) loadingSpan.style.display = 'none';
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ERC20BatchTransfer();
}); 