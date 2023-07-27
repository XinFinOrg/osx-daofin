import { ClientCore, Context, PluginInstallItem } from "@xinfin/osx-client-common";
import {
  IDaofinClient,
  IDaofinClientDecoding,
  IDaofinClientEncoding,
  IDaofinClientEstimation,
  IDaofinClientMethods,
} from "./internal/interfaces";
import { DaofinClientMethods } from "./internal/client/methods";
import { DaofinClientEncoding } from "./internal/client/encoding";
import { DaofinClientDecoding } from "./internal/client/decoding";
import { DaofinClientEstimation } from "./internal/client/estimation";
import { Networkish } from "@ethersproject/providers";

export class DaofinClient extends ClientCore implements IDaofinClient {
  public methods: IDaofinClientMethods;
  public encoding: IDaofinClientEncoding;
  public decoding: IDaofinClientDecoding;
  public estimation: IDaofinClientEstimation;
  constructor(context: Context) {
    super(context);
    this.methods = new DaofinClientMethods(context);
    this.encoding = new DaofinClientEncoding(context);
    this.decoding = new DaofinClientDecoding(context);
    this.estimation = new DaofinClientEstimation(context);
  }

  static encoding ={
    getPluginInstallItem: (
        params: any,
        network: Networkish,
      ): PluginInstallItem =>
        DaofinClientEncoding.getPluginInstallItem(params, network),
    };
  }

