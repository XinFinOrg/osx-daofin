import {getPluginInstallationId} from '../../commons/ids';
import {
  Plugin,
  PluginProposal,
  Action,
  PluginDeposit,
  PluginJudiciary,
  Dao,
} from '../../generated/schema';
import {
  ProposalCreated,
  Deposited,
  DaofinPlugin,
  JudiciaryChanged,
} from '../../generated/templates/DaofinPlugin/DaofinPlugin';
import {
  getDepositId,
  getJudiciaryId,
  getProposalId,
} from '../../utils/proposals';
import {Address, dataSource} from '@graphprotocol/graph-ts';

export function handleProposalCreated(event: ProposalCreated): void {
  let context = dataSource.context();
  let daoId = context.getString('daoAddress');
  let metdata = event.params.metadata.toString();
  let pluginAddress = event.address;
  let pluginProposalId = event.params.proposalId;
  let proposalId = getProposalId(pluginAddress, pluginProposalId);
  let pluginInstallationId = getPluginInstallationId(
    Address.fromString(daoId.toString()),
    pluginAddress
  );
  let entity = PluginProposal.load(proposalId);
  if (!entity) {
    entity = new PluginProposal(proposalId);
  }
  entity.dao = daoId;
  entity.allowFailureMap = event.params.allowFailureMap;
  entity.plugin = pluginInstallationId
    ? pluginInstallationId.toHexString()
    : '';
  entity.pluginProposalId = pluginProposalId;
  entity.creator = event.params.creator;
  entity.metadata = event.params.metadata.toString();
  entity.createdAt = event.block.timestamp;
  entity.creationBlockNumber = event.block.number;
  entity.snapshotBlock = event.block.number;
  entity.executed = false;
  for (let index = 0; index < event.params.actions.length; index++) {
    const action = event.params.actions[index];
    let actionId = getProposalId(pluginAddress, pluginProposalId)
      .concat('_')
      .concat(index.toString());
    let actionEntity = new Action(actionId);
    actionEntity.to = action.to;
    actionEntity.value = action.value;
    actionEntity.data = action.data;
    actionEntity.dao = daoId;
    actionEntity.proposal = proposalId;
    actionEntity.save();
  }
  let contract = DaofinPlugin.bind(pluginAddress);
  const proposalObj = contract.try_getProposal(pluginProposalId);
  if (proposalObj.reverted) return;
  const proposalParams = proposalObj.value.getParameters();
  entity.startDate = proposalParams.startDate;
  entity.endDate = proposalParams.endDate;
  entity.save();
}
export function handleDeposited(event: Deposited): void {
  let context = dataSource.context();
  let daoId = context.getString('daoAddress');
  const depositId = getDepositId(
    event.transaction.from,
    Address.fromString(daoId),
    event.block.number
  );
  const plugin = event.transaction.to;
  if (!plugin) {
    return;
  }
  let pluginInstallationId = getPluginInstallationId(
    Address.fromString(daoId.toString()),
    plugin
  );
  let entity = PluginDeposit.load(depositId);
  if (!entity) {
    entity = new PluginDeposit(depositId);
  }
  entity.amount = event.params._amount;
  entity.voter = event.params._depositer;
  entity.snapshotBlock = event.block.number;
  entity.txHash = event.transaction.hash;
  entity.depositDate = event.block.timestamp;
  entity.dao = daoId;
  if (pluginInstallationId) {
    entity.plugin = pluginInstallationId.toHexString();
  }
  entity.save();
}
export function handleJudiciaryChanged(event: JudiciaryChanged): void {
  let context = dataSource.context();
  let daoId = context.getString('daoAddress');
  let pluginInstallationId = context.getString('pluginInstallationId');
  let dao = Dao.load(daoId.toString());
  if (!dao) return;
  let plugin = Plugin.load(pluginInstallationId);
  if (!plugin) return;

  let judiciaryId = getJudiciaryId(
    plugin.id,
    event.params._member,
    event.params._action,
    event.block.number
  );
  let entity = PluginJudiciary.load(judiciaryId);
  if (!entity) {
    entity = new PluginJudiciary(judiciaryId);
  }
  entity.plugin = plugin.id;
  entity.dao = daoId;
  entity.creationDate = event.block.timestamp;
  entity.member = event.params._member;
  entity.txHash = event.transaction.hash;
  entity.action = event.params._action;
  entity.snapshotBlock = event.block.number;
  entity.save();
}
