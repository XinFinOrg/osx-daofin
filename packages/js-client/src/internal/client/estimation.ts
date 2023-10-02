import { DaofinPluginCore } from '../../core';
import { IDaofinClientEstimation } from '../interfaces';
import { ClientCore, GasFeeEstimation } from '@xinfin/osx-client-common';
import { CreateMultisigProposalParams } from '@xinfin/osx-sdk-client';

export class DaofinClientEstimation
  extends DaofinPluginCore
  implements IDaofinClientEstimation
{
  createProposal: (
    params: CreateMultisigProposalParams
  ) => Promise<GasFeeEstimation>;
}
