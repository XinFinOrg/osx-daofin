import { DaofinPluginCore } from '../../core';
import { IDaofinClientDecoding } from '../interfaces';
import { ClientCore, InterfaceParams } from '@xinfin/osx-client-common';

export class DaofinClientDecoding
  extends DaofinPluginCore
  implements IDaofinClientDecoding
{
  findInterface: (data: Uint8Array) => InterfaceParams;
}
