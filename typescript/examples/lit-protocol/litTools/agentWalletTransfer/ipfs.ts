import * as path from 'path';
import * as fs from 'fs';

const DEFAULT_CIDS = {
  'datil-dev': {
    tool: 'QmUPnnuz8E3wKYG7bCxqnjjhV9anE9uMxHXY4fTv7Z5Y6A',
    defaultPolicy: 'QmVHC5cTWE1nzBSzEASULdwfHo1QiYMEr5Ht83anxe6uWB',
  },
  'datil-test': {
    tool: 'QmRcwjz5EpUaABPMwhgYwsDsy1noYNYkhr6nC8JqWUPEoy',
    defaultPolicy: 'QmVHC5cTWE1nzBSzEASULdwfHo1QiYMEr5Ht83anxe6uWB',
  },
  'datil': {
    tool: 'QmQ1k3ZzmoPDukAphQ353WJ73XaNFnhmztr1v2hfTprW3V',
    defaultPolicy: 'QmVHC5cTWE1nzBSzEASULdwfHo1QiYMEr5Ht83anxe6uWB',
  },
} as const;

let deployedCids = DEFAULT_CIDS;
const ipfsPath = path.join(__dirname, '../../../dist/ipfs.json');

if (fs.existsSync(ipfsPath)) {
  try {
    const ipfsContent = fs.readFileSync(ipfsPath, 'utf-8');
    deployedCids = JSON.parse(ipfsContent);
  } catch (error) {
    console.warn('Failed to load ipfs.json, using default CIDs:', error);
  }
} else {
  console.warn('ipfs.json not found. Using default deployed CIDs.');
}

export const IPFS_CIDS = deployedCids;
