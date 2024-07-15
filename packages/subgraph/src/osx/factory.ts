import {Deployed} from '../../generated/DaofinPluginFactory/DaofinPluginFactory';
import {setupEntities} from '../../utils/deployment';
import {log} from '@graphprotocol/graph-ts';

export function handleDeployed(event: Deployed): void {
  setupEntities(event.params.dao, event.params.plugin);
  log.info('hey beny', []);
}
