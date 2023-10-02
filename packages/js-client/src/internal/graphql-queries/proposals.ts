import { gql } from 'graphql-request';

export const ProposalQuery = gql`
  query ProposalQuery($proposalId: ID!) {
    plugin(id: $proposalId) {
      id
      proposals {
        id
        failureMap
        pluginProposalId
        creator
        metadata
        startDate
        endDate
        creationBlockNumber
        snapshotBlock
        executed
        actions {
          id
          to
          value
          data
        }
      }
    }
  }
`;
export const ProposalsQuery = gql`
  query ProposalsQuery($pluginId: ID!) {
    pluginProposals(where: { plugin: $pluginId }) {
      id
      pluginProposalId
      failureMap
      creator
      metadata
      startDate
      endDate
      creationBlockNumber
      snapshotBlock
      executed
      actions {
        id
        to
        value
        data
      }
    }
  }
`;
