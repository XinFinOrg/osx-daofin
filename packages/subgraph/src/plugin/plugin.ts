import {getPluginInstallationId} from '../../commons/ids';
import {
  Plugin,
  PluginProposal,
  Action,
  PluginDeposit,
  PluginJudiciary,
  Dao,
  PluginMasterNodeDelegatee,
  PluginProposalVote,
  PluginProposalType,
  CommitteeVotingSettings,
} from '../../generated/schema';
import {
  ProposalCreated,
  Deposited,
  DaofinPlugin,
  JudiciaryChanged,
  UpdateOrJoinMasterNodeDelegateeCall,
  MasterNodeDelegateeUpdated,
  VoteReceived,
  ProposalTypeCreated,
  ProposalIdToProposalTypeIdAttached,
} from '../../generated/templates/DaofinPlugin/DaofinPlugin';
import {
  getDepositId,
  getJudiciaryId,
  getMasterNodeDelegateeId,
  getPluginProposalVoteId,
  getProposalId,
} from '../../utils/proposals';
import {
  Address,
  BigInt,
  ByteArray,
  Bytes,
  dataSource,
} from '@graphprotocol/graph-ts';

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
  entity.creationTxHash = event.transaction.hash;
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
  const proposalObj = contract.try__proposals(pluginProposalId);
  if (proposalObj.reverted) return;
  entity.startDate = proposalObj.value.getStartDate();
  entity.endDate = proposalObj.value.getEndDate();
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
export function handleMasterNodeDelegateeUpdated(
  event: MasterNodeDelegateeUpdated
): void {
  let context = dataSource.context();
  let daoId = context.getString('daoAddress');
  let pluginInstallationId = context.getString('pluginInstallationId');
  let dao = Dao.load(daoId.toString());
  if (!dao) return;
  let plugin = Plugin.load(pluginInstallationId);
  if (!plugin) return;

  let id = getMasterNodeDelegateeId(
    pluginInstallationId,
    event.params._masterNode
  );
  let entity = PluginMasterNodeDelegatee.load(id);
  if (entity) {
    if (entity.masterNode == event.params._masterNode) {
      if (entity.member != event.params._delegatee) {
        entity.state = 'CHANGED';
        entity.member = event.params._delegatee;
        entity.updatedDate = event.block.timestamp;

        entity.save();
      }
    }
  } else {
    entity = new PluginMasterNodeDelegatee(id);

    entity.dao = daoId;
    entity.plugin = pluginInstallationId;

    entity.member = event.params._delegatee;
    entity.masterNode = event.params._masterNode;
    entity.creationDate = event.block.timestamp;
    entity.snapshotBlock = event.block.number;

    entity.action = BigInt.fromString('0');
    entity.txHash = event.transaction.hash;

    entity.save();
  }
}

export function handleVoteReceived(event: VoteReceived): void {
  let context = dataSource.context();

  let daoId = context.getString('daoAddress');
  let pluginInstallationId = context.getString('pluginInstallationId');
  let dao = Dao.load(daoId.toString());
  if (!dao) return;

  let plugin = Plugin.load(pluginInstallationId);
  if (!plugin) return;

  let pluginProposalId = event.params._proposalId;
  let voter = event.params._voter;

  let proposalId = getProposalId(event.address, pluginProposalId);

  let pluginProposal = PluginProposal.load(proposalId);
  if (!pluginProposal) return;

  let pluginProposalVoteId = getPluginProposalVoteId(
    daoId,
    pluginInstallationId,
    pluginProposalId,
    voter
  );
  let entity = PluginProposalVote.load(pluginProposalVoteId);

  if (entity) return;

  entity = new PluginProposalVote(pluginProposalVoteId);
  entity.voter = voter;
  entity.plugin = pluginInstallationId;
  entity.pluginProposalId = pluginProposalId;
  entity.committee = event.params._committee;
  entity.creationDate = event.block.timestamp;
  entity.option = event.params._voteOption;
  entity.txHash = event.transaction.hash;
  entity.snapshotBlock = event.block.number;
  entity.proposal = pluginProposal.pluginProposalId.toHexString();

  entity.save();
}

export function handleProposalTypeCreated(event: ProposalTypeCreated): void {
  let context = dataSource.context();

  let daoId = context.getString('daoAddress');
  let pluginInstallationId = context.getString('pluginInstallationId');
  let dao = Dao.load(daoId.toString());
  if (!dao) return;

  let plugin = Plugin.load(pluginInstallationId);
  if (!plugin) return;

  let pluginProposalTypeId = event.params._proposalType.toHexString();

  let pluginProposalType = PluginProposalType.load(pluginProposalTypeId);

  if (pluginProposalType) return;

  pluginProposalType = new PluginProposalType(pluginProposalTypeId);

  pluginProposalType.txHash = event.transaction.hash;
  pluginProposalType.creationDate = event.block.timestamp;
  pluginProposalType.plugin = plugin.id;

  pluginProposalType.save();

  for (let i = 0; i < event.params._settings.length; i++) {
    let item = event.params._settings[i];

    let setting = new CommitteeVotingSettings(
      pluginProposalTypeId.concat(item.name.toHexString())
    );

    setting.name = item.name;
    setting.minParticipation = item.minParticipation;
    setting.minVotingPower = item.minVotingPower;
    setting.supportThreshold = item.supportThreshold;
    setting.proposalType = pluginProposalTypeId;

    setting.save();
  }
}

export function handleProposalIdToProposalTypeIdAttached(
  event: ProposalIdToProposalTypeIdAttached
): void {
  let context = dataSource.context();

  let daoId = context.getString('daoAddress');
  let pluginInstallationId = context.getString('pluginInstallationId');
  let dao = Dao.load(daoId.toString());
  if (!dao) return;

  let plugin = Plugin.load(pluginInstallationId);
  if (!plugin) return;

  let pluginProposalId = event.params._proposalId.toHexString();
  let pluginProposalTypeId = event.params._proposalTypeId.toHexString();

  let pluginAddress = event.address;

  let proposalId = getProposalId(pluginAddress, event.params._proposalId);

  let pluginProposalType = PluginProposalType.load(pluginProposalTypeId);
  if (!pluginProposalType) return;

  let entity = PluginProposal.load(proposalId);
  if (!entity) return;

  entity.proposalType = pluginProposalTypeId;
  entity.save();
}
