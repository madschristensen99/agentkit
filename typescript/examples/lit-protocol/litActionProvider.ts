import { ActionProvider, ViemWalletProvider, Network, CreateAction } from "@coinbase/agentkit";
import { z } from "zod";
import * as LitJsSdk from "@lit-protocol/lit-node-client";
import { LIT_NETWORK } from '@lit-protocol/constants';
import { LIT_ABILITY } from "@lit-protocol/constants";
import {
  LitActionResource,
  createSiweMessage,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { Wallet } from "ethers"; // Import Wallet from ethers

const LitActionSchema = z.object({
    jsParams: z.object({
        magicNumber: z.number().describe("The magic number to be logged in the Lit Action")
    }).describe("Parameters to pass to the Lit Action"),
});

class LitActionProvider extends ActionProvider<ViemWalletProvider> {
  constructor() {
    super("lit-action-provider", []);
  }

  @CreateAction({
    name: "execute_lit_action",
    description: "Execute a Lit Protocol action",
    schema: LitActionSchema,
  })
  async executeLitAction(walletProvider: ViemWalletProvider, args: z.infer<typeof LitActionSchema>): Promise<string> {
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

      // Define the Lit Action code
      const litActionCode = `
        (async () => {
          const magicNumber = ${args.jsParams.magicNumber};
          console.log("The magic number is:", magicNumber);
          Lit.Actions.setResponse({ response: JSON.stringify({ magicNumber }) });
        })();
      `;

      // Execute the Lit Action
      const response = await litNodeClient.executeJs({
        sessionSigs: sessionSignatures,
        code: litActionCode,
        jsParams: args.jsParams,
      });

      return `Lit Action executed successfully. Response: ${JSON.stringify(response)}`;
    } catch (error) {
      console.error("Error in lit action handler:", error);
      throw error;
    }
    
  }

  supportsNetwork = (network: Network) => true;
}

export const litActionProvider = () => new LitActionProvider();
