// ============================================
// CRYPTOVAULT BACKEND API SERVER
// Production-ready Node.js/Express server
// ============================================

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { ethers } = require('ethers');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Strict rate limit for RPC calls
const rpcLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'RPC rate limit exceeded'
});

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    INFURA_KEY: process.env.INFURA_KEY || '2eb003d772d345c48214cad05878e67c',
    ALCHEMY_KEY: process.env.ALCHEMY_KEY || 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t',
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY || '',
    
    // RPC Endpoints
    RPC_ENDPOINTS: {
        ETH_MAINNET: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
        ETH_SEPOLIA: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
        BNB_MAINNET: 'https://bsc-dataseed1.binance.org',
        BNB_TESTNET: 'https://bsc-testnet.publicnode.com',
        POLYGON_MAINNET: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        POLYGON_TESTNET: `https://polygon-amoy.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        ARBITRUM_MAINNET: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        OPTIMISM_MAINNET: `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        BASE_MAINNET: `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`,
        AVALANCHE_MAINNET: 'https://api.avax.network/ext/bc/C/rpc',
        SOLANA_MAINNET: 'https://api.mainnet-beta.solana.com',
        SOLANA_DEVNET: 'https://api.devnet.solana.com'
    }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

// Log analytics events to database or external service
const logAnalytics = (event, data) => {
    console.log(`[ANALYTICS] ${event}:`, JSON.stringify(data));
    // TODO: Send to analytics service (Mixpanel, PostHog, etc.)
    // Example: mixpanel.track(event, data);
};

// Validate Ethereum address
const isValidEthAddress = (address) => {
    return ethers.utils.isAddress(address);
};

// Validate Solana address
const isValidSolAddress = (address) => {
    try {
        return address && address.length >= 32 && address.length <= 44;
    } catch (e) {
        return false;
    }
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get RPC endpoint (protected)
app.post('/api/rpc-proxy', rpcLimiter, async (req, res) => {
    try {
        const { chain, network, method, params } = req.body;
        
        if (!chain || !network) {
            return res.status(400).json({ error: 'Missing chain or network parameter' });
        }
        
        // Get appropriate RPC endpoint
        const rpcKey = `${chain.toUpperCase()}_${network.toUpperCase()}`;
        const rpcUrl = CONFIG.RPC_ENDPOINTS[rpcKey];
        
        if (!rpcUrl) {
            return res.status(400).json({ error: 'Unsupported chain/network combination' });
        }
        
        // Forward request to RPC
        const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
        const result = await provider.send(method, params || []);
        
        logAnalytics('RPC_Call', { chain, network, method, ip: req.ip });
        
        res.json({ success: true, result });
        
    } catch (error) {
        console.error('RPC proxy error:', error);
        res.status(500).json({ error: 'RPC call failed', message: error.message });
    }
});

// Get balance (protected endpoint)
app.post('/api/balance', rpcLimiter, async (req, res) => {
    try {
        const { address, chain, network } = req.body;
        
        // Validate inputs
        if (!address || !chain || !network) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }
        
        if (chain !== 'SOLANA' && !isValidEthAddress(address)) {
            return res.status(400).json({ error: 'Invalid Ethereum address' });
        }
        
        if (chain === 'SOLANA' && !isValidSolAddress(address)) {
            return res.status(400).json({ error: 'Invalid Solana address' });
        }
        
        // Get RPC endpoint
        const rpcKey = `${chain.toUpperCase()}_${network.toUpperCase()}`;
        const rpcUrl = CONFIG.RPC_ENDPOINTS[rpcKey];
        
        if (!rpcUrl) {
            return res.status(400).json({ error: 'Unsupported chain/network' });
        }
        
        let balance;
        
        if (chain === 'SOLANA') {
            // Handle Solana balance
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
            // Handle EVM balance
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            const balanceWei = await provider.getBalance(address);
            balance = ethers.utils.formatEther(balanceWei);
        }
        
        logAnalytics('Balance_Check', { address, chain, network, ip: req.ip });
        
        res.json({ success: true, balance });
        
    } catch (error) {
        console.error('Balance check error:', error);
        res.status(500).json({ error: 'Failed to fetch balance', message: error.message });
    }
});

// Get cryptocurrency prices
app.get('/api/prices', async (req, res) => {
    try {
        const coins = 'ethereum,binancecoin,matic-network,avalanche-2,fantom,mantle,tether,usd-coin,solana';
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd`;
        
        const response = await fetch(url, {
            headers: CONFIG.COINGECKO_API_KEY ? {
                'x-cg-pro-api-key': CONFIG.COINGECKO_API_KEY
            } : {}
        });
        
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
        // Return fallback prices
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

// Estimate gas fees
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
        const gasLimit = 21000; // Standard ETH transfer
        
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

// Track analytics event
app.post('/api/analytics', async (req, res) => {
    try {
        const { event, properties } = req.body;
        
        if (!event) {
            return res.status(400).json({ error: 'Missing event name' });
        }
        
        // Log analytics
        logAnalytics(event, {
            ...properties,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            timestamp: new Date().toISOString()
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to log analytics' });
    }
});

// Validate transaction before sending
app.post('/api/validate-transaction', async (req, res) => {
    try {
        const { from, to, amount, chain, network } = req.body;
        
        // Validate addresses
        if (chain !== 'SOLANA') {
            if (!isValidEthAddress(from) || !isValidEthAddress(to)) {
                return res.json({ valid: false, error: 'Invalid address format' });
            }
        } else {
            if (!isValidSolAddress(from) || !isValidSolAddress(to)) {
                return res.json({ valid: false, error: 'Invalid Solana address' });
            }
        }
        
        // Validate amount
        if (!amount || parseFloat(amount) <= 0) {
            return res.json({ valid: false, error: 'Invalid amount' });
        }
        
        // Check if sender has sufficient balance
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

// Get token balances (ERC20)
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

// Get investor card stats
app.get('/api/investor-cards/stats', (req, res) => {
    // This would normally query a database
    // For now, return mock data
    res.json({
        success: true,
        totalMinted: 156,
        maxCards: 1000,
        remaining: 844
    });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`
    ╔════════════════════════════════════════╗
    ║   CRYPTOVAULT BACKEND API SERVER      ║
    ╠════════════════════════════════════════╣
    ║   Port: ${PORT}                        ║
    ║   Environment: ${process.env.NODE_ENV || 'development'}           ║
    ║   Status: ONLINE                       ║
    ╚════════════════════════════════════════╝
    `);
    
    console.log('Available endpoints:');
    console.log('  GET  /health');
    console.log('  GET  /api/prices');
    console.log('  POST /api/rpc-proxy');
    console.log('  POST /api/balance');
    console.log('  POST /api/gas-estimate');
    console.log('  POST /api/validate-transaction');
    console.log('  POST /api/token-balances');
    console.log('  POST /api/analytics');
    console.log('  GET  /api/investor-cards/stats');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
