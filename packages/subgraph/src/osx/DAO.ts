import {Dao, DaoDeposit, PluginDeposit} from '../../generated/schema';
import {Deposited} from '../../generated/templates/DaoTemplateV1_0_0/DAO';
import {dataSource} from '@graphprotocol/graph-ts';

export function handleDeposited(event: Deposited): void {
  let daoContractAddress = event.transaction.to;
  if (!daoContractAddress) return;

  let daoContract = Dao.load(daoContractAddress.toHexString());

  if (!daoContract) return;

  let daoDepositId = daoContractAddress.concat(event.transaction.hash);
  let daoDeposit = DaoDeposit.load(daoDepositId.toHexString());
  if (daoDeposit) return;

  daoDeposit = new DaoDeposit(daoDepositId.toHexString());

  daoDeposit.depositDate = event.block.timestamp;
  daoDeposit.dao = daoContractAddress.toHexString();
  daoDeposit.amount = event.params.amount;
  daoDeposit.snapshotBlock = event.block.number;
  daoDeposit.txHash = event.transaction.hash;
  daoDeposit.sender = event.params.sender;
  daoDeposit.save();
}
