'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, ArrowUpDown, TrendingUp, Wallet, LogOut, Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import * as web3 from '@solana/web3.js'
import * as splToken from '@solana/spl-token'

interface Token {
  id: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  value: number;
  change: string;
  createdAt: string;
}

export function MainPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTokenName, setNewTokenName] = useState('')
  const [newTokenSymbol, setNewTokenSymbol] = useState('')
  const [newTokenDescription, setNewTokenDescription] = useState('')
  const [newTokenImage, setNewTokenImage] = useState<File | null>(null)

  useEffect(() => {
    const ws = new WebSocket('wss://pumpportal.fun/api/data');

    ws.onopen = () => {
      console.log('WebSocket connecté');
      const payload = {
        method: "subscribeNewToken"
      };
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      const newToken = JSON.parse(event.data);
      console.log('Nouveau token reçu:', newToken);
      setTokens(prevTokens => [
        {
          id: newToken.ca || '',
          name: newToken.name || 'Token sans nom',
          symbol: newToken.symbol || '',
          description: "Nouveau token créé",
          imageUrl: "",
          value: 0,
          change: "0",
          createdAt: new Date().toISOString()
        },
        ...prevTokens
      ]);
    };

    ws.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket déconnecté');
    };

    return () => {
      ws.close();
    };
  }, []);

  const handleCreateToken = async () => {
    if (!walletConnected) {
      alert("Veuillez connecter votre wallet avant de créer un token.");
      return;
    }

    if (!newTokenName || !newTokenSymbol || !newTokenDescription || !newTokenImage) {
      alert("Veuillez remplir tous les champs et sélectionner une image.");
      return;
    }

    try {
      // Utiliser le devnet au lieu du mainnet pour le développement et les tests
      const connection = new web3.Connection(web3.clusterApiUrl('devnet'), 'confirmed');
      const { solana } = window as any;
      const wallet = solana;

      if (!wallet) {
        throw new Error("Wallet non trouvé");
      }

      const payer = wallet.publicKey;
      const mintKeypair = web3.Keypair.generate();

      const createMintAccountIx = web3.SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintKeypair.publicKey,
        space: splToken.MINT_SIZE,
        lamports: await connection.getMinimumBalanceForRentExemption(splToken.MINT_SIZE),
        programId: splToken.TOKEN_PROGRAM_ID,
      });

      const initializeMintIx = splToken.createInitializeMintInstruction(
        mintKeypair.publicKey,
        9,
        payer,
        payer,
        splToken.TOKEN_PROGRAM_ID
      );

      const transaction = new web3.Transaction().add(createMintAccountIx, initializeMintIx);

      try {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = payer;

        // Demander au wallet connecté d'approuver et de signer la transaction
        const signedTransaction = await wallet.signTransaction(transaction);
        signedTransaction.partialSign(mintKeypair);

        const signature = await connection.sendRawTransaction(signedTransaction.serialize());
        await connection.confirmTransaction(signature);

        console.log(`Token SPL créé avec succès sur le devnet. Adresse: ${mintKeypair.publicKey.toBase58()}`);

        const imageUrl = URL.createObjectURL(newTokenImage);
        const newToken: Token = {
          id: mintKeypair.publicKey.toBase58(),
          name: newTokenName,
          symbol: newTokenSymbol,
          description: newTokenDescription,
          imageUrl: imageUrl,
          value: 0,
          change: "0",
          createdAt: new Date().toISOString()
        };
        setTokens(prevTokens => [newToken, ...prevTokens]);

        // Réinitialiser les champs
        setNewTokenName('');
        setNewTokenSymbol('');
        setNewTokenDescription('');
        setNewTokenImage(null);
        setIsCreateDialogOpen(false);

        alert(`Token SPL créé avec succès sur le devnet ! Adresse: ${mintKeypair.publicKey.toBase58()}`);
      } catch (signError) {
        console.error("Erreur lors de la signature de la transaction:", signError);
        alert("La transaction a été rejetée ou n'a pas pu être signée.");
      }
    } catch (error) {
      console.error("Erreur lors de la création du token:", error);
      alert("Une erreur est survenue lors de la création du token.");
    }
  }

  const filteredAndSortedTokens = tokens
    .filter(token => (token.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortOrder === 'highest') return b.value - a.value
      if (sortOrder === 'lowest') return a.value - b.value
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

  const connectWallet = async () => {
    try {
      const { solana } = window as any;

      if (solana && solana.isPhantom) {
        const response = await solana.connect();
        console.log('Wallet connecté!', response.publicKey.toString());
        setWalletConnected(true);
        setWalletAddress(response.publicKey.toString());
      } else {
        alert("Phantom wallet n'est pas installé!");
      }
    } catch (error) {
      console.error("Erreur lors de la connexion au wallet:", error);
    }
  }

  const disconnectWallet = () => {
    const { solana } = window as any;
    if (solana && solana.isPhantom) {
      solana.disconnect();
      setWalletConnected(false);
      setWalletAddress('');
      console.log('Wallet déconnecté');
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <nav className="bg-gray-800 p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-8 w-8 text-blue-400" />
            <h1 className="text-2xl font-bold text-blue-400">PUMP PATT</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-500 hover:bg-green-600 text-white" disabled={!walletConnected}>
                  <Plus className="mr-2 h-4 w-4" /> Créer Token
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-800 text-white">
                <DialogHeader>
                  <DialogTitle>Créer un nouveau SPL Token sur le devnet</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Nom
                    </Label>
                    <Input id="name" value={newTokenName} onChange={(e) => setNewTokenName(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="symbol" className="text-right">
                      Symbole
                    </Label>
                    <Input id="symbol" value={newTokenSymbol} onChange={(e) => setNewTokenSymbol(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Textarea id="description" value={newTokenDescription} onChange={(e) => setNewTokenDescription(e.target.value)} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="image" className="text-right">
                      Image
                    </Label>
                    <Input id="image" type="file" onChange={(e) => setNewTokenImage(e.target.files?.[0] || null)} className="col-span-3" />
                  </div>
                </div>
                <Button onClick={handleCreateToken}>Créer Token sur le devnet</Button>
              </DialogContent>
            </Dialog>
            {walletConnected ? (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-300">{walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}</span>
                <Button onClick={disconnectWallet} className="bg-red-500 hover:bg-red-600 text-white">
                  <LogOut className="mr-2 h-4 w-4" /> Déconnecter
                </Button>
              </div>
            ) : (
              <Button onClick={connectWallet} className="bg-purple-500 hover:bg-purple-600 text-white">
                <Wallet className="mr-2 h-4 w-4" /> Connecter Wallet
              </Button>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-8">
        <div className="flex space-x-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher des tokens..."
              className="pl-10 bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-400 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select onValueChange={setSortOrder} defaultValue={sortOrder}>
            <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700 text-gray-100">
              <SelectValue placeholder="Trier par" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-gray-100">
              <SelectItem value="newest">Plus récent</SelectItem>
              <SelectItem value="highest">Valeur la plus élevée</SelectItem>
              <SelectItem value="lowest">Valeur la plus basse</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredAndSortedTokens.map((token) => (
              <motion.div
                key={token.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-gray-800 border-gray-700 overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h2 className="text-xl font-semibold text-blue-400">{token.name}</h2>
                        <p className="text-sm text-gray-400">{token.symbol}</p>
                      </div>
                      <span className={`text-sm px-2 py-1 rounded ${parseFloat(token.change) >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {token.change}%
                      </span>
                    </div>
                    {token.imageUrl && (
                      <div className="mb-4">
                        <img src={token.imageUrl} alt={token.name} className="w-full h-32 object-cover rounded" />
                      </div>
                    )}
                    <p className="text-sm text-gray-300 mb-4">{token.description}</p>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-3xl font-bold">${token.value.toLocaleString()}</p>
                        <p className="text-sm text-gray-400">Créé le: {new Date(token.createdAt).toLocaleString()}</p>
                      </div>
                      <Button variant="outline" className="text-blue-400 border-blue-400 hover:bg-blue-400/10">
                        Échanger
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
