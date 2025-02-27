import { ActionProvider, ViemWalletProvider, Network, CreateAction } from "@coinbase/agentkit";
import { z } from "zod";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_NETWORK, LIT_ABILITY } from '@lit-protocol/constants';
import {
  LitActionResource,
  createSiweMessage,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { Wallet } from "ethers"; // Import Wallet from ethers
import { ERC20Transfer } from "./litTools/agentWalletTransfer/tool";
import { ERC20TransferPolicy } from './litTools/agentWalletTransfer/policy';
import { IPFS_CIDS } from './litTools/agentWalletTransfer/ipfs';

const TransferSchema = z.object({
    pkpEthAddress: z.string().describe("The PKP ETH address"),
    rpcUrl: z.string().describe("The RPC URL for the network"),
    chainId: z.string().describe("The chain ID"),
    tokenIn: z.string().describe("The token address to transfer"),
    recipientAddress: z.string().describe("The recipient's address"),
    amountIn: z.string().describe("The amount to transfer"),
});
  
class AgentWalletTransferProvider extends ActionProvider<ViemWalletProvider> {
  constructor() {
    super("lit-agent-transfer", []);
  }

  @CreateAction({
    name: "agent_wallet_transfer",
    description: "Execute a Lit Protocol agent wallet transfer",
    schema: TransferSchema,
  })
  async executeLitAction(walletProvider: ViemWalletProvider, args: z.infer<typeof TransferSchema>): Promise<string> {
    try {
      const litNodeClient = new LitJsSdk.LitNodeClient({
        alertWhenUnauthorized: false,
        litNetwork: LIT_NETWORK.DatilDev,
        debug: false,
      });
      await litNodeClient.connect();

      // Get the private key from the environment variable
      const privateKey = process.env.EVM_PRIVATE_KEY; // Ensure EVM_PRIVATE_KEY is set in your .env file
      if (!privateKey) {
        throw new Error("Private key not found in environment variables.");
      }

      // Create an ethers.js wallet from the private key
      const ethersWallet = new Wallet(privateKey);

      // Generate session signatures
      const sessionSignatures = await litNodeClient.getSessionSigs({
        chain: "ethereum",
        expiration: new Date(Date.now() + 1000 * 60 * 10).toISOString(), // 10 minutes
        resourceAbilityRequests: [
          {
            resource: new LitActionResource("*"),
            ability: LIT_ABILITY.LitActionExecution, // Use the correct enum value
          },
        ],
        authNeededCallback: async ({ uri, expiration, resourceAbilityRequests }) => {
          const toSign = await createSiweMessage({
            uri,
            expiration,
            resources: resourceAbilityRequests,
            walletAddress: await ethersWallet.getAddress(),
            nonce: await litNodeClient.getLatestBlockhash(),
            litNodeClient,
          });

          return await generateAuthSig({
            signer: ethersWallet,
            toSign,
          });
        },
      });
      // Get the appropriate tool for the network
      const tool = ERC20Transfer[LIT_NETWORK.DatilDev];
      
      const amountInWei = parseInt(args.amountIn, 18).toString();
      // Create and validate policy
      const policy = {
        type: "ERC20Transfer" as const,
        version: ERC20TransferPolicy.version,
        erc20Decimals: "18",
        maxAmount: amountInWei, // Use the amount in wei
        allowedTokens: [args.tokenIn],
        allowedRecipients: [args.recipientAddress]
      };
      console.log("Policy: ", policy);
      // Validate policy against schema
      ERC20TransferPolicy.schema.parse(policy);

      // Encode policy for execution
      const encodedPolicy = ERC20TransferPolicy.encode(policy);

      // Get IPFS CID for the network
      const ipfsCid = IPFS_CIDS['datil-dev'].tool;


      // Execute the Lit Action
      const response = await litNodeClient.executeJs({
        sessionSigs: sessionSignatures,
        ipfsId: ipfsCid,
        jsParams: {
          params: {
            ...args,
            encodedPolicy
          }
        },
      });

      return `Lit Action executed successfully. Response: ${JSON.stringify(response)}`;
    } catch (error) {
      console.error("Error in lit action handler:", error);
      throw error;
    }
    
  }

  supportsNetwork = (network: Network) => true;
}

export const agentWalletTransferProvider = () => new AgentWalletTransferProvider();
