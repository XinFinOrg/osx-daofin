import { GlobalSettings } from '../types';
import { DaofinPlugin } from '@xinfin/osx-daofin-contracts-ethers';
import { DaoDetails } from '@xinfin/osx-sdk-client';

export interface IDaofinClientMethods {
  getGlobalSettings(addressOrEns: string): Promise<GlobalSettings>;
  getDaofin(daoAddressOrEns: string): Promise<DaoDetails | null>;
  getVotingSettings: (addressOrEns: string) => Promise<GlobalSettings>;
}
export interface IDaofinClientEncoding {}
export interface IDaofinClientDecoding {}
export interface IDaofinClientEstimation {}

export interface IDaofinClient {
  methods: IDaofinClientMethods;
  encoding: IDaofinClientEncoding;
  decoding: IDaofinClientDecoding;
  estimation: IDaofinClientEstimation;
}
