import {BytesLike, ethers} from 'ethers';
import IPFS from 'ipfs-http-client';

export async function uploadToIPFS(
  content: string,
  testing: boolean = true
): Promise<string> {
  const ipfsUrl = process.env.IPFS_URL || '';
  const ipfsApiKey = process.env.IPFS_API_KEY || '';
  const ipfsApiSecret = process.env.IPFS_API_SECRET || '';
  const encodeAuthCred = Buffer.from(`${ipfsApiKey}:${ipfsApiSecret}`).toString(
    'base64'
  );
  const client = IPFS.create({
    url: ipfsUrl,
    headers: {
      Authorization: `Basic ${encodeAuthCred}`,
    },
  });

  const cid = await client.add(content);
  await client.pin.add(cid.cid);
  return cid.path;
}

export function toHex(input: string): BytesLike {
  return ethers.utils.hexlify(ethers.utils.toUtf8Bytes(input));
}
