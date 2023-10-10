import {XDCValidator, XDCValidator__factory} from '../../typechain';
import {Signer} from 'ethers';

export async function deployXDCValidator(
  signer: Signer
): Promise<XDCValidator> {
  const xdcValidator = new XDCValidator__factory(signer);
  return await xdcValidator.deploy();
}
