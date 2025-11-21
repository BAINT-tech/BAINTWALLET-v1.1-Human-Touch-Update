<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BaintWallet - Premium Multi-Chain Wallet</title>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.umd.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap');
        
        * {
            font-family: 'Poppins', sans-serif;
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body { 
            margin: 0; 
            padding: 0;
        }
        
        .animated-bg {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            background-size: 200% 200%;
            animation: gradientShift 15s ease infinite;
        }
        
        @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        .glass-card {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 2px solid rgba(255, 255, 255, 0.5);
            box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
        }
        
        .dark .glass-card {
            background: rgba(20, 20, 40, 0.95);
            border: 2px solid rgba(139, 92, 246, 0.3);
            color: #f5f5f5;
        }
        
        .dark { color: #f5f5f5; }
        
        .premium-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            transition: all 0.3s;
        }
        
        .premium-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
        }
        
        .spinner { 
            display: inline-block;
            animation: spin 1s linear infinite; 
        }
        
        @keyframes spin { 
            to { transform: rotate(360deg); } 
        }
        
        .hover-lift {
            transition: all 0.3s;
        }
        
        .hover-lift:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(102, 126, 234, 0.3);
        }

        .notification-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
        }

        .fade-in {
            animation: fadeIn 0.5s ease-in;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div id="root"></div>
    
    <script type="text/babel">
        const { useState, useEffect, useRef } = React;
        
        function App() {
          const [wallet, setWallet] = useState(null);
          const [loading, setLoading] = useState(false);
          const [message, setMessage] = useState('');
          const [seedInput, setSeedInput] = useState('');
          const [view, setView] = useState('intro');
          const [introStep, setIntroStep] = useState(0);
          const [sendTo, setSendTo] = useState('');
          const [sendAmount, setSendAmount] = useState('');
          const [isTestnet, setIsTestnet] = useState(true);
          const [chain, setChain] = useState('ETH');
          const [txs, setTxs] = useState([]);
          const [showSeed, setShowSeed] = useState(false);
          const [darkMode, setDarkMode] = useState(false);
          const [prices, setPrices] = useState({});
          const [tokens, setTokens] = useState([]);
          const [loadingTokens, setLoadingTokens] = useState(false);
          const [selectedToken, setSelectedToken] = useState(null);
          const [sendTokenAmount, setSendTokenAmount] = useState('');
          const [wcUri, setWcUri] = useState('');
          const [wcConnected, setWcConnected] = useState(false);
          const [dappUrl, setDappUrl] = useState('https://app.uniswap.org');
          const [notifications, setNotifications] = useState([]);
          const [showNotifications, setShowNotifications] = useState(false);
          const [referralCode, setReferralCode] = useState('');
          const [userId, setUserId] = useState('');
          const [customNetworks, setCustomNetworks] = useState([]);
          const [showAddNetwork, setShowAddNetwork] = useState(false);
          const [newNetwork, setNewNetwork] = useState({ name: '', rpc: '', chainId: '', symbol: '', explorer: '' });
          const qrRef = useRef(null);

          const INFURA_KEY = '2eb003d772d345c48214cad05878e67c';
          const ALCHEMY_KEY = 'RV7R38aklgHvDsNjslY6Xo9ptfJ--r2t';

          const chains = {
            ETH: {
              name: 'Ethereum', symbol: 'ETH', icon: '⟠', color: 'from-blue-500 to-purple-600',
              testnet: { 
                rpc: [`https://sepolia.infura.io/v3/${INFURA_KEY}`, `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_KEY}`, 'https://rpc.sepolia.org'],
                explorer: 'https://sepolia.etherscan.io', 
                chainId: 11155111 
              },
              mainnet: { 
                rpc: [`https://mainnet.infura.io/v3/${INFURA_KEY}`, `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`, 'https://eth.llamarpc.com'],
                explorer: 'https://etherscan.io', 
                chainId: 1 
              }
            },
            BNB: {
              name: 'BNB Chain', symbol: 'BNB', icon: '◆', color: 'from-yellow-400 to-orange-500',
              testnet: { 
                rpc: ['https://bsc-testnet.publicnode.com', 'https://data-seed-prebsc-1-s1.binance.org:8545'],
                explorer: 'https://testnet.bscscan.com', 
                chainId: 97 
              },
              mainnet: { 
                rpc: ['https://bsc-dataseed1.binance.org', 'https://bsc.publicnode.com', 'https://bsc-dataseed2.binance.org'],
                explorer: 'https://bscscan.com', 
                chainId: 56 
              }
            }
          };

          const TOKEN_ADDRESSES = {
            ETH: { USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'},
            BNB: { USDT: '0x55d398326f99059fF775485246999027B3197955', USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' }
          };

          const ERC20_ABI = ["function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)", "function symbol() view returns (string)", "function transfer(address to, uint256 amount) returns (bool)", "function name() view returns (string)"];

          const introSlides = [
            { icon: '🌟', title: 'Welcome to BaintWallet', description: 'Premium wallet with 15+ chains!', gradient: 'from-blue-500 to-purple-600' },
            { icon: '🔐', title: 'Your Keys, Your Crypto', description: 'Military-grade security.', gradient: 'from-purple-500 to-pink-600' },
            { icon: '⚡', title: 'Multi-Chain Magic', description: 'Ethereum, BNB, Polygon & more!', gradient: 'from-yellow-400 to-orange-500' },
            { icon: '💎', title: 'Zero Fees Forever', description: 'FREE sends, WalletConnect, DApp Browser!', gradient: 'from-indigo-500 to-purple-600' }
          ];

          const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(''), 4000); };
          const addNotification = (icon, title, msg) => {
            setNotifications(prev => [{id: Date.now(), icon, title, message: msg, time: new Date().toLocaleTimeString(), read: false}, ...prev.slice(0, 19)]);
          };

          const getProviderWithRetry = async () => {
            const c = chains[chain];
            const network = isTestnet ? c.testnet : c.mainnet;
            const rpcList = Array.isArray(network.rpc) ? network.rpc : [network.rpc];
            
            for (let i = 0; i < rpcList.length; i++) {
              try {
                const provider = new ethers.providers.JsonRpcProvider(rpcList[i]);
                await provider.getNetwork();
                return provider;
              } catch (e) {
                if (i === rpcList.length - 1) throw new Error(`All RPCs failed for ${chain}`);
              }
            }
          };

          const createWallet = async () => {
            setLoading(true);
            try {
              const w = ethers.Wallet.createRandom();
              const provider = await getProviderWithRetry();
              const balance = await provider.getBalance(w.address);
              setWallet({ address: w.address, privateKey: w.privateKey, mnemonic: w.mnemonic.phrase, balance: ethers.utils.formatEther(balance) });
              showMsg('✅ Wallet created!');
              addNotification('✨', 'Success', 'Wallet ready!');
              setView('wallet');
            } catch (e) { 
              showMsg('❌ Error: ' + e.message);
            }
            setLoading(false);
          };

          useEffect(() => {
            let uid = localStorage.getItem('baintwallet_user_id');
            if (!uid) {
              uid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
              localStorage.setItem('baintwallet_user_id', uid);
            }
            setUserId(uid);
            setReferralCode('BAINT-' + uid.slice(-6).toUpperCase());
          }, []);

          return (
            <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
              <div className="animated-bg min-h-screen p-4 md:p-8">
                <div className="max-w-md mx-auto">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white">BaintWallet</h1>
                    <div className="flex gap-2">
                      <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-3 glass-card rounded-xl">
                        <span className="text-2xl">🔔</span>
                        {notifications.filter(n => !n.read).length > 0 && <div className="notification-badge">{notifications.filter(n => !n.read).length}</div>}
                      </button>
                      <button onClick={() => setDarkMode(!darkMode)} className="p-3 glass-card rounded-xl">
                        <span className="text-2xl">{darkMode ? '☀️' : '🌙'}</span>
                      </button>
                    </div>
                  </div>

                  {message && <div className="glass-card rounded-2xl p-4 mb-4 text-center font-semibold fade-in">{message}</div>}

                  {view === 'intro' && (
                    <div className="glass-card rounded-3xl p-8 hover-lift fade-in">
                      <div className="text-6xl mb-6 text-center">{introSlides[introStep].icon}</div>
                      <h2 className={`text-3xl font-bold mb-4 text-center bg-gradient-to-r ${introSlides[introStep].gradient} text-transparent bg-clip-text`}>{introSlides[introStep].title}</h2>
                      <p className="text-gray-600 dark:text-gray-300 text-center mb-8 leading-relaxed">{introSlides[introStep].description}</p>
                      <div className="flex gap-2 justify-center mb-6">
                        {introSlides.map((_, i) => <div key={i} className={`h-3 rounded-full transition-all ${i === introStep ? 'w-8 bg-purple-600' : 'w-3 bg-gray-300'}`} />)}
                      </div>
                      <div className="flex gap-3">
                        {introStep < introSlides.length - 1 ? (
                          <>
                            <button onClick={() => setView('create')} className="flex-1 py-4 rounded-xl border-2 border-purple-500 text-purple-600 font-semibold">Skip</button>
                            <button onClick={() => setIntroStep(introStep + 1)} className="flex-1 py-4 rounded-xl premium-button text-white font-bold">Next</button>
                          </>
                        ) : (
                          <button onClick={() => setView('create')} className="w-full py-4 rounded-xl premium-button text-white font-bold text-lg">Get Started 🚀</button>
                        )}
                      </div>
                    </div>
                  )}

                  {view === 'create' && (
                    <div className="glass-card rounded-3xl p-8 hover-lift fade-in">
                      <div className="text-6xl text-center mb-6">✨</div>
                      <h2 className="text-2xl font-bold text-center mb-6">Create New Wallet</h2>
                      <button onClick={createWallet} disabled={loading} className="w-full py-4 rounded-xl premium-button text-white font-bold text-lg disabled:opacity-50">
                        {loading ? <span className="spinner">⟳</span> : 'Create Wallet (FREE)'}
                      </button>
                    </div>
                  )}

                  {view === 'wallet' && wallet && (
                    <div className="glass-card rounded-3xl p-8 fade-in">
                      <h2 className="text-2xl font-bold mb-4">Your Wallet</h2>
                      <p className="text-sm break-all bg-gray-100 dark:bg-gray-800 p-3 rounded">{wallet.address}</p>
                      <p className="text-3xl font-bold mt-4">{parseFloat(wallet.balance).toFixed(4)} ETH</p>
                    </div>
                  )}

                  <div className="text-center mt-8 text-white/70 text-sm">
                    <p>Made with 💜 by BaintWallet</p>
                    <p className="text-xs mt-2">15+ Chains • Zero Fees • WalletConnect</p>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        ReactDOM.createRoot(document.getElementById('root')).render(<App />);
    </script>
</body>
</html>
