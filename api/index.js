// ============================================
// CRYPTOVAULT BACKEND API - VERCEL SERVERLESS
// ============================================

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { ethers } = require('ethers');

const app = express();

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.'
});

app.use('/api/', limiter);

const rpcLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'RPC rate limit exceeded'
});

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    INFURA_KEY: process.env.INFURA_KEY || '2eb003d772d345c48214cad05878e67c',
    ALCHEMY_KEY: process.env.ALCHEMY_KEY || 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t',
    
    RPC_ENDPOINTS: {
        ETH_MAINNET: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY || '2eb003d772d345c48214cad05878e67c'}`,
        ETH_SEPOLIA: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY || '2eb003d772d345c48214cad05878e67c'}`,
        BNB_MAINNET: 'https://bsc-dataseed1.binance.org',
        BNB_TESTNET: 'https://bsc-testnet.publicnode.com',
        POLYGON_MAINNET: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY || 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t'}`,
        ARBITRUM_MAINNET: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY || 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t'}`,
        OPTIMISM_MAINNET: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY || 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t'}`,
        BASE_MAINNET: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY || 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t'}`,
        AVALANCHE_MAINNET: 'https://api.avax.network/ext/bc/C/rpc',
        SOLANA_MAINNET: 'https://api.mainnet-beta.solana.com',
        SOLANA_DEVNET: 'https://api.devnet.solana.com'
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const isValidEthAddress = (address) => {
    return ethers.utils.isAddress(address);
};

const isValidSolAddress = (address) => {
    return address && address.length >= 32 && address.length <= 44;
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

app.get('/api', (req, res) => {
    res.json({
        name: 'CryptoVault Backend API',
        version: '1.0.0',
        status: 'online'
    });
});

// Get balance
app.post('/api/balance', rpcLimiter, async (req, res) => {
    try {
        const { address, chain, network } = req.body;
        
        if (!address || !chain || !network) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        if (chain !== 'SOLANA' && !isValidEthAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        if (chain === 'SOLANA' && !isValidSolAddress(address)) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }
        
        const rpcKey = `${chain.toUpperCase()}_${network.toUpperCase()}`;
        const rpcUrl = CONFIG.RPC_ENDPOINTS[rpcKey];
        
        if (!rpcUrl) {
            return res.status(400).json({ error: 'Unsupported chain/network' });
        }
        
        let balance;
        
        if (chain === 'SOLANA') {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [address]
                })
            });
            const data = await response.json();
            balance = (data.result.value / 1000000000).toFixed(6);
        } else {
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const balanceWei = await provider.getBalance(address);
            balance = ethers.utils.formatEther(balanceWei);
        }
        
        res.json({ success: true, balance });
        
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ error: 'Failed to fetch balance', message: error.message });
    }
});

// Get prices
app.get('/api/prices', async (req, res) => {
    try {
        const coins = 'ethereum,binancecoin,matic-network,avalanche-2,fantom,mantle,tether,usd-coin,solana';
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        const prices = {
            ETH: data.ethereum?.usd || 2500,
            BNB: data.binancecoin?.usd || 300,
            MATIC: data['matic-network']?.usd || 0.8,
            AVAX: data['avalanche-2']?.usd || 25,
            FTM: data.fantom?.usd || 0.4,
            MNT: data.mantle?.usd || 0.8,
            SOL: data.solana?.usd || 150,
            USDT: 1.0,
            USDC: 1.0
        };
        
        res.json({ success: true, prices });
        
    } catch (error) {
        console.error('Price fetch error:', error);
        res.json({
            success: true,
            prices: {
                ETH: 2500, BNB: 300, MATIC: 0.8, AVAX: 25,
                FTM: 0.4, MNT: 0.8, SOL: 150, USDT: 1.0, USDC: 1.0
            },
            fallback: true
        });
    }
});

// Gas estimate
app.post('/api/gas-estimate', rpcLimiter, async (req, res) => {
    try {
        const { chain, network } = req.body;
        
        if (chain === 'SOLANA') {
            return res.json({
                success: true,
                gasPrice: '0.000005',
                gasLimit: 1,
                totalCost: '0.000005',
                currency: 'SOL'
            });
        }
        
        const rpcKey = `${chain.toUpperCase()}_${network.toUpperCase()}`;
        const rpcUrl = CONFIG.RPC_ENDPOINTS[rpcKey];
        
        if (!rpcUrl) {
            return res.status(400).json({ error: 'Unsupported chain/network' });
        }
        
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const gasPrice = await provider.getGasPrice();
        const gasLimit = 21000;
        
        const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
        const totalCost = ethers.utils.formatEther(gasPrice.mul(gasLimit));
        
        res.json({
            success: true,
            gasPrice: gasPriceGwei,
            gasLimit,
            totalCost,
            currency: 'ETH'
        });
        
    } catch (error) {
        console.error('Gas estimation error:', error);
        res.status(500).json({ error: 'Failed to estimate gas', message: error.message });
    }
});

// Validate transaction
app.post('/api/validate-transaction', async (req, res) => {
    try {
        const { from, to, amount, chain, network } = req.body;
        
        if (chain !== 'SOLANA') {
            if (!isValidEthAddress(from) || !isValidEthAddress(to)) {
                return res.json({ valid: false, error: 'Invalid address format' });
            }
        } else {
            if (!isValidSolAddress(from) || !isValidSolAddress(to)) {
                return res.json({ valid: false, error: 'Invalid Solana address' });
            }
        }
        
        if (!amount || parseFloat(amount) <= 0) {
            return res.json({ valid: false, error: 'Invalid amount' });
        }
        
        const rpcKey = `${chain.toUpperCase()}_${network.toUpperCase()}`;
        const rpcUrl = CONFIG.RPC_ENDPOINTS[rpcKey];
        
        if (!rpcUrl) {
            return res.json({ valid: false, error: 'Unsupported chain/network' });
        }
        
        let balance;
        if (chain === 'SOLANA') {
            const response = await fetch(rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [from]
                })
            });
            const data = await response.json();
            balance = data.result.value / 1000000000;
        } else {
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const balanceWei = await provider.getBalance(from);
            balance = parseFloat(ethers.utils.formatEther(balanceWei));
        }
        
        if (balance < parseFloat(amount)) {
            return res.json({ valid: false, error: 'Insufficient balance' });
        }
        
        res.json({ valid: true, balance: balance.toString() });
        
    } catch (error) {
        console.error('Transaction validation error:', error);
        res.status(500).json({ valid: false, error: 'Validation failed' });
    }
});

// Analytics
app.post('/api/analytics', async (req, res) => {
    try {
        const { event, properties } = req.body;
        console.log('Analytics:', event, properties);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to log analytics' });
    }
});

// Token balances
app.post('/api/token-balances', rpcLimiter, async (req, res) => {
    try {
        const { address, chain, network, tokens } = req.body;
        
        if (network !== 'MAINNET') {
            return res.json({ success: true, tokens: [] });
        }
        
        if (!isValidEthAddress(address)) {
            return res.status(400).json({ error: 'Invalid address' });
        }
        
        const rpcKey = `${chain.toUpperCase()}_${network.toUpperCase()}`;
        const rpcUrl = CONFIG.RPC_ENDPOINTS[rpcKey];
        
        if (!rpcUrl) {
            return res.status(400).json({ error: 'Unsupported chain/network' });
        }
        
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const tokenBalances = [];
        
        const ERC20_ABI = [
            "function balanceOf(address) view returns (uint256)",
            "function decimals() view returns (uint8)",
            "function symbol() view returns (string)",
            "function name() view returns (string)"
        ];
        
        for (const [symbol, tokenAddress] of Object.entries(tokens)) {
            try {
                const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
                const [balance, decimals, name] = await Promise.all([
                    contract.balanceOf(address),
                    contract.decimals(),
                    contract.name()
                ]);
                
                const formattedBalance = ethers.utils.formatUnits(balance, decimals);
                
                if (parseFloat(formattedBalance) > 0) {
                    tokenBalances.push({
                        symbol,
                        name,
                        address: tokenAddress,
                        balance: formattedBalance,
                        decimals
                    });
                }
            } catch (e) {
                console.error(`Error loading token ${symbol}:`, e.message);
            }
        }
        
        res.json({ success: true, tokens: tokenBalances });
        
    } catch (error) {
        console.error('Token balance error:', error);
        res.status(500).json({ error: 'Failed to fetch token balances' });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Export for Vercel
module.exports = app;
