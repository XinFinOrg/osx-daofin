import { DaofinPluginContext } from './context';
import { DaofinPluginCore } from './core';
import { DaofinClientDecoding } from './internal/client/decoding';
import { DaofinClientEncoding } from './internal/client/encoding';
import { DaofinClientEstimation } from './internal/client/estimation';
import { DaofinClientMethods } from './internal/client/methods';
import {
  IDaofinClient,
  IDaofinClientDecoding,
  IDaofinClientEncoding,
  IDaofinClientEstimation,
  IDaofinClientMethods,
} from './internal/interfaces';
import { Networkish } from '@ethersproject/providers';
import {
  ClientCore,
  Context,
  PluginInstallItem,
} from '@xinfin/osx-client-common';

export class DaofinClient extends DaofinPluginCore implements IDaofinClient {
  public methods: IDaofinClientMethods;
  public encoding: IDaofinClientEncoding;
  public decoding: IDaofinClientDecoding;
  public estimation: IDaofinClientEstimation;

  constructor(context: DaofinPluginContext) {
    super(context);
    this.methods = new DaofinClientMethods(context);
    this.encoding = new DaofinClientEncoding(context);
    this.decoding = new DaofinClientDecoding(context);
    this.estimation = new DaofinClientEstimation(context);
  }

  static encoding = {
    getPluginInstallItem: (
      params: any,
      network: Networkish
    ): PluginInstallItem =>
      DaofinClientEncoding.getPluginInstallItem(params, network),
  };
}
