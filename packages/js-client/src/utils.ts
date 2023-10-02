import { SubgraphProposalBase } from './types';
import { ProposalBase, ProposalMetadata } from '@aragon/sdk-client-common';
import { defaultAbiCoder } from '@ethersproject/abi';
import { keccak256 } from '@ethersproject/keccak256';
import { getCompactProposalId } from '@xinfin/osx-sdk-common';

export const toProposalListItem = (
  proposal: SubgraphProposalBase,
  metadata: ProposalMetadata
) => {
  const startDate = new Date(parseInt(proposal.startDate) * 1000);
  const endDate = new Date(parseInt(proposal.endDate) * 1000);
  return {
    id: getCompactProposalId(proposal.id),
    dao: {
      address: proposal.dao.id,
    },
    creatorAddress: proposal.creator,
    metadata: {
      title: metadata.title,
      summary: metadata.summary,
    },
    startDate,
    endDate,
    executed: proposal.executed,
    potentiallyExecutable: proposal.potentiallyExecutable,
  };
};

export function getPluginInstallationId(
  daoAddress: string,
  pluginAddress: string
): string {
  return keccak256(
    defaultAbiCoder.encode(['address', 'address'], [daoAddress, pluginAddress])
  );
}
