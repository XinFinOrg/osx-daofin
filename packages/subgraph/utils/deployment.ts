import {getDaoId, getPluginInstallationId} from '../commons/ids';
import {Dao, Plugin} from '../generated/schema';
import {DaofinPlugin} from '../generated/templates';
import {DAO_ADDRESS, PLUGIN_ADDRESS} from './constants';
import {Address, BigInt, DataSourceContext} from '@graphprotocol/graph-ts';

export function setupEntities(dao: Address, plugin: Address): void {
  let daoStr = dao.toHexString();
  let pluginStr = plugin.toHexString();

  let daoAddr = dao;
  let pluginAddr = plugin;

  const daoId = getDaoId(daoAddr);
  let doaEntity = Dao.load(daoId);
  if (!doaEntity) {
    doaEntity = new Dao(daoId);
    doaEntity.save();
  }
  let pluginId = getPluginInstallationId(daoAddr, pluginAddr);
  if (!pluginId) return;

  let pluginEntity = Plugin.load(pluginId.toHexString());
  if (!pluginEntity) {
    pluginEntity = new Plugin(pluginId.toHexString());
    pluginEntity.dao = getDaoId(daoAddr);

    pluginEntity.creationBlockNumber = new BigInt(0);
    pluginEntity.save();

    // Create template
    const context = new DataSourceContext();
    context.setString('daoAddress', getDaoId(daoAddr));
    context.setString('pluginInstallationId', pluginId.toHexString());
    DaofinPlugin.createWithContext(pluginAddr, context);

    pluginEntity.save();
  }
}
export function getDAOAddress(): Address {
  return Address.fromString(DAO_ADDRESS);
}
export function getPluginAddress(): Address {
  return Address.fromString(PLUGIN_ADDRESS);
}
