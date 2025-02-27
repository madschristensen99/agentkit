import { BaseEthereumAddressSchema } from '@lit-protocol/aw-tool';
import { z } from 'zod';
import { ethers } from 'ethers';

// First, ensure we're using ethers correctly
const { AbiCoder } = ethers;
const abiCoder = new AbiCoder();

/**
 * Schema for validating an ERC20 transfer policy.
 * @type {z.ZodObject}
 */
const policySchema = z.object({
  type: z.literal('ERC20Transfer'),
  version: z.string(),
  erc20Decimals: z.string().refine(
    (val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    },
    {
      message: 'Invalid decimals format. Must be a non-negative integer not exceeding 255.',
    }
  ),
  maxAmount: z.string().refine(
    (val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num >= 0;
    },
    {
      message: 'Invalid amount format. Must be a positive integer.',
    }
  ),
  allowedTokens: z.array(BaseEthereumAddressSchema),
  allowedRecipients: z.array(BaseEthereumAddressSchema),
});

/**
 * Encodes an ERC20 transfer policy into a string.
 * @param {ERC20TransferPolicyType} policy - The policy to encode.
 * @returns {string} The encoded policy as a string.
 * @throws Will throw an error if the policy is invalid according to the schema.
 */
function encodePolicy(policy: ERC20TransferPolicyType): string {
  // Validate the policy against the schema
  policySchema.parse(policy);
  
  // Use the AbiCoder instance directly
  return abiCoder.encode(
    [
      'tuple(uint8 erc20Decimals, uint256 maxAmount, address[] allowedTokens, address[] allowedRecipients)',
    ],
    [
      {
        erc20Decimals: policy.erc20Decimals,
        maxAmount: ethers.parseUnits(policy.maxAmount, parseInt(policy.erc20Decimals)).toString(),
        allowedTokens: policy.allowedTokens,
        allowedRecipients: policy.allowedRecipients,
      },
    ]
  );
}

/**
 * Decodes an encoded ERC20 transfer policy string into a policy object.
 * @param {string} encodedPolicy - The encoded policy string to decode.
 * @returns {ERC20TransferPolicyType} The decoded policy object.
 * @throws Will throw an error if the decoded policy is invalid according to the schema.
 */
function decodePolicy(encodedPolicy: string): ERC20TransferPolicyType {
  // Use the AbiCoder instance for decoding
  const decoded = abiCoder.decode(
    [
      'tuple(uint8 erc20Decimals, uint256 maxAmount, address[] allowedTokens, address[] allowedRecipients)',
    ],
    encodedPolicy
  )[0];
  const policy: ERC20TransferPolicyType = {
    type: 'ERC20Transfer',
    version: '1.0.0',
    erc20Decimals: decoded.erc20Decimals.toString(),
    maxAmount: decoded.maxAmount.toString(),
    allowedTokens: decoded.allowedTokens,
    allowedRecipients: decoded.allowedRecipients,
  };
  return policySchema.parse(policy);
}

/**
 * Type representing an ERC20 transfer policy.
 * @typedef {z.infer<typeof policySchema>} ERC20TransferPolicyType
 */
export type ERC20TransferPolicyType = z.infer<typeof policySchema>;

/**
 * Utility object for working with ERC20 transfer policies.
 * @type {object}
 * @property {ERC20TransferPolicyType} type - Type placeholder for the policy.
 * @property {string} version - Version of the policy schema.
 * @property {z.ZodObject} schema - Zod schema for validating policies.
 * @property {function} encode - Function to encode a policy into an ABI-encoded string.
 * @property {function} decode - Function to decode an ABI-encoded string into a policy.
 */
export const ERC20TransferPolicy = {
  type: {} as ERC20TransferPolicyType,
  version: '1.0.0',
  schema: policySchema,
  encode: encodePolicy,
  decode: decodePolicy,
};
